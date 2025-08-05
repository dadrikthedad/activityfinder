"use client";

import { useAuth } from "@/context/AuthContext";
import { useCurrentUser } from "@/store/useUserCacheStore";
import { useChatStore } from "@/store/useChatStore";
import { useRouter, useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useUserActionPopoverStore } from "@/store/useUserActionPopoverStore";
import { UserSummaryDTO } from "@/types/UserSummaryDTO";
import { MessageDTO } from "@/types/MessageDTO";
import { clearDraftFor } from "@/utils/draft/draft";
import { useSendMessage } from "@/hooks/messages/useSendMessage";
import MessageList from "@/components/messages/MessageList";
import MessageInput from "@/components/messages/MessageInput";
import { ArrowLeft } from "lucide-react";

export default function ConversationPage() {
  const { isLoggedIn } = useAuth();
  const currentUser = useCurrentUser();
  const router = useRouter();
  const params = useParams();
  const conversationId = params?.id ? parseInt(params.id as string) : null;
  
  // Chat store state
  const { 
    setCurrentConversationId, 
    currentConversationId,
    conversations 
  } = useChatStore();
  
  const currentConversation = conversations.find(c => c.id === conversationId);
  const pending = useChatStore(state => state.pendingMessageRequests);
  const pendingLockedConversationId = useChatStore(state => state.pendingLockedConversationId);
  
  // States
  const [conversationError, setConversationError] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<MessageDTO | null>(null);
  const [atBottom, setAtBottom] = useState(true);
  
  const { send } = useSendMessage();
  
  // Check if conversation has error
  const hasConversationError = conversationError !== null;

  // ALL HOOKS MUST BE CALLED BEFORE ANY EARLY RETURNS

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isLoggedIn) {
      router.push('/login');
    }
  }, [isLoggedIn, router]);

  // Redirect if invalid conversation ID
  useEffect(() => {
    if (isLoggedIn && !conversationId) {
      router.push('/messages');
    }
  }, [conversationId, router, isLoggedIn]);

  // Set current conversation on mount and cleanup on unmount
  useEffect(() => {
    if (conversationId) {
      setCurrentConversationId(conversationId);
      
      // Set pending locked conversation if it's a pending request
      const isPending = pending.some(r => r.conversationId === conversationId);
      if (isPending) {
        useChatStore.getState().setPendingLockedConversationId(conversationId);
      }
    }
    
    return () => {
      // Cleanup when leaving the page
      const state = useChatStore.getState();
      
      // Convert optimistic messages to real
      if (conversationId) {
        state.convertOptimisticToReal(conversationId);
        
        // Cache messages
        const live = state.liveMessages[conversationId] ?? [];
        const cached = state.cachedMessages[conversationId] ?? [];
        const combined = [
          ...cached,
          ...live.filter(m => !cached.some(c => c.id === m.id))
        ];
        state.setCachedMessages(conversationId, combined);
        state.clearLiveMessages(conversationId);
      }
      
      // Reset current conversation
      setCurrentConversationId(null);
      state.setPendingLockedConversationId(null);
    };
  }, [conversationId, setCurrentConversationId, pending]);

  // Clear draft when conversation error occurs
  useEffect(() => {
    if (hasConversationError && conversationId) {
      clearDraftFor(conversationId);
    }
  }, [hasConversationError, conversationId]);

  // User popover handler
  const showUserPopover = useCallback((
    user: UserSummaryDTO,
    pos: { x: number; y: number },
    groupData?: {
      isGroup: boolean;
      participants: UserSummaryDTO[];
      onLeaveGroup?: () => void;
      isPendingRequest?: boolean;
      conversationId?: number;
    },
    event?: Event
  ) => {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    // Get fresh data from store for groups
    const conversation = groupData?.isGroup && groupData?.conversationId 
      ? useChatStore.getState().conversations.find(c => c.id === groupData.conversationId)
      : undefined;

    // Send updated user object
    const updatedUser = groupData?.isGroup && conversation 
      ? {
          ...user,
          fullName: conversation.groupName || user.fullName,
          profileImageUrl: conversation.groupImageUrl || user.profileImageUrl
        }
      : user;

    useUserActionPopoverStore.getState().show({
      user: updatedUser,
      position: pos,
      ...groupData,
    });
  }, []);

  // Reply handler
  const handleReply = useCallback((message: MessageDTO) => {
    setReplyingTo(message);
  }, []);

  // Retry message handler
  const handleRetryMessage = useCallback(async (failedMessage: MessageDTO) => {
    if (!failedMessage.optimisticId || !conversationId) return;
    
    console.log("🔄 Retrying message:", failedMessage.optimisticId);
    
    // Mark as sending again
    useChatStore.getState().updateMessage(conversationId, failedMessage.id, {
      ...failedMessage,
      isSending: true,
      sendError: null
    });

    // Build messageData from failed message
    const messageData = {
      text: failedMessage.text || undefined,
      files: undefined,
      conversationId: conversationId,
      receiverId: undefined,
      parentMessageId: failedMessage.parentMessageId 
    };

    try {
      const result = await send(messageData);
      
      if (!result) {
        // Send failed again
        useChatStore.getState().updateMessage(conversationId, failedMessage.id, {
          ...failedMessage,
          isSending: false,
          sendError: "Retry failed - please try again"
        });
      }
    } catch (err: unknown) {
      console.error("❌ Retry failed:", err);
      
      const errorMessage = err instanceof Error 
        ? err.message 
        : "Retry failed";
      
      useChatStore.getState().updateMessage(conversationId, failedMessage.id, {
        ...failedMessage,
        isSending: false,
        sendError: errorMessage
      });
    }
  }, [send, conversationId]);

  // Delete failed message handler
  const handleDeleteFailedMessage = useCallback((failedMessage: MessageDTO) => {
    if (!conversationId) return;
    
    console.log("🗑️ Deleting failed message:", failedMessage.optimisticId);
    
    // Remove message from liveMessages
    const current = useChatStore.getState().liveMessages[conversationId] || [];
    const filtered = current.filter(m => m.id !== failedMessage.id);
    
    // Update store directly
    useChatStore.setState((state) => ({
      liveMessages: {
        ...state.liveMessages,
        [conversationId]: filtered
      }
    }));
  }, [conversationId]);

  // Get conversation title for header
  const getConversationTitle = () => {
    if (!currentConversation) return "Laster samtale...";
    
    if (currentConversation.isGroup) {
      return currentConversation.groupName || "Navnløs gruppe";
    }
    
    const otherUser = currentConversation.participants.find(p => p.id !== currentUser?.id);
    return otherUser?.fullName || "Ukjent bruker";
  };

  // Get conversation subtitle for header
  const getConversationSubtitle = () => {
    if (!currentConversation) return "";
    
    if (currentConversation.isGroup) {
      return `${currentConversation.participants.length} medlemmer`;
    }
    
    return "Privat samtale";
  };

  // NOW EARLY RETURNS AFTER ALL HOOKS
  // Early returns for loading states
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-4 border-t-green-600 border-gray-200"></div>
      </div>
    );
  }

  if (!conversationId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-4 border-t-green-600 border-gray-200"></div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-gray-50 dark:bg-gray-900 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="bg-white dark:bg-[#1e2122] shadow-sm border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
        <div className="px-4 py-4">
          <div className="flex items-center gap-4">
            {/* Back button */}
            <button
              onClick={() => router.push('/messages')}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition"
              aria-label="Tilbake til meldinger"
            >
              <ArrowLeft size={20} className="text-gray-600 dark:text-gray-400" />
            </button>
            
            {/* Conversation info */}
            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
                {getConversationTitle()}
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
                {getConversationSubtitle()}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Warning banners */}
      <div className="flex-shrink-0">
        {currentConversation?.isPendingApproval && conversationId !== pendingLockedConversationId && (
          <div className="bg-yellow-300 border-b border-yellow-400 text-yellow-800 px-4 py-2 text-center">
            <p className="text-xs">
              Message request sent. You can send a maximum of 5 messages the receiver will be able to see.
            </p>
          </div>
        )}

        {pending.some((r) => r.conversationId === conversationId) &&
          conversationId === pendingLockedConversationId && (
            <div className="bg-yellow-300 border-b border-yellow-400 text-yellow-800 px-4 py-2 text-center">
              <p className="text-xs">
                Approve the conversation to start sending messages.
              </p>
            </div>
        )}
      </div>

      {/* Message list - takes remaining space */}
      <div className="flex-1 bg-white dark:bg-[#1e2122] min-h-0 overflow-hidden">
        <MessageList
          key={conversationId}
          currentUser={currentUser}
          onShowUserPopover={showUserPopover}
          conversationVisible={true}
          onScrollPositionChange={setAtBottom}
          onReply={handleReply}
          onConversationError={setConversationError}
          onRetryMessage={handleRetryMessage}
          onDeleteFailedMessage={handleDeleteFailedMessage}
        />
      </div>

      {/* Message input - at bottom */}
      <div className="bg-white dark:bg-[#1e2122] border-t border-gray-200 dark:border-gray-700 p-3 flex-shrink-0">
        <MessageInput
          receiverId={undefined}
          onMessageSent={(message) => {
            console.log("📤 Ny melding sendt:", message);
            setReplyingTo(null);
          }}
          atBottom={atBottom}
          onShowUserPopover={showUserPopover}
          replyingTo={replyingTo}
          onClearReply={() => setReplyingTo(null)}
          isDisabled={hasConversationError}
          hideToolbar={hasConversationError}
          conversationError={conversationError}
          autoFocus={false}
        />
      </div>
    </div>
  );
}