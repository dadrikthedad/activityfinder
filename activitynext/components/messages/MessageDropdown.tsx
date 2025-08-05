"use client";

import MessageList from "./MessageList";
import ConversationList from "./ConversationList";
import { UserSummaryDTO } from "@/types/UserSummaryDTO";
import MessageInput from "./MessageInput";
import PendingRequestsList from "./PendingMessageList";
import { useEffect, useRef, useState, useCallback } from "react";
import { useOverlay, useOverlayAutoClose } from "@/context/OverlayProvider";
import { useChatStore } from "@/store/useChatStore";
import { useConversationSearch } from "@/hooks/messages/useSearchConversations";
import Spinner from "../common/Spinner";
import NotificationsPanel from "@/components/messages/NotificationsPanel";
import NewMessageWindow from "./NewMessageWindow";
import { MessageDTO } from "@/types/MessageDTO";
import { SendGroupRequestsResponseDTO } from "@/types/SendGroupRequestsDTO";
import ProfileNavButton from "../settings/ProfileNavButton";
import { useUserActionPopoverStore } from "@/store/useUserActionPopoverStore";
import { createPortal } from "react-dom";
import { clearDraftFor } from "@/utils/draft/draft";
import { useSendMessage } from "@/hooks/messages/useSendMessage";

interface MessageDropdownProps {
  currentUser: UserSummaryDTO | null;
  onCloseDropdown: () => void;
  initialPosition?: { x: number; y: number };
}

function debounce<A extends unknown[], R>(
  fn: (...args: A) => R,
  delay: number
): (...args: A) => void {
  let timer: ReturnType<typeof setTimeout>;
  return (...args: A) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

export default function MessageDropdown({ 
  currentUser, 
  onCloseDropdown, 
  initialPosition, 
}: MessageDropdownProps) {
  const { currentConversationId, setCurrentConversationId } = useChatStore();
  const pending = useChatStore(state => state.pendingMessageRequests);
  const hasLoadedPending = useChatStore(state => state.hasLoadedPendingRequests);
  const currentConversation = useChatStore((state) =>
    state.conversations.find((c) => c.id === currentConversationId)
  );
  const pendingLockedConversationId = useChatStore((state) => state.pendingLockedConversationId);

  // Chat store state
  const setShowMessages = useChatStore((s) => s.setShowMessages);

  const mainOverlay = useOverlay();
  // ✅ REMOVED: newMessageOverlay - vi skal ikke bruke overlay for nested NewMessageWindow

  const dropdownRef = useRef<HTMLDivElement>(null);

  // Dropdown refs og sizing
  const DROPDOWN_SIZE_KEY = "messageDropdownSize";

  // States
  const [showNewMessageDialog, setShowNewMessageDialog] = useState(false);
  const [newMessageInitialReceiver, setNewMessageInitialReceiver] = useState<UserSummaryDTO | undefined>();
  
  // User popover states
  const [conversationVisible, setConversationVisible] = useState(true);

   const conversationId = useChatStore((state) => state.currentConversationId);
  const { send } = useSendMessage();

  // Drag and drop states
  const [isDragging, setIsDragging] = useState(false);
  const positionRef = useRef({ x: 0, y: 0 });
  const offsetRef = useRef({ x: 0, y: 0 });
  const DROPDOWN_POSITION_KEY = "messageDropdownPosition";

  const [atBottom, setAtBottom] = useState(true);
  

  // Search functionality
  const {
    query: searchQuery,
    setQuery: setSearchQuery,
    results: searchResults,
    loading: searchLoading,
  } = useConversationSearch();

  const shouldShowPendingSection = !hasLoadedPending || pending.length > 0;

  // Hvis samtalen får en feil så har vi det her
  const [conversationError, setConversationError] = useState<string | null>(null);
  // Sjekk om det er en "deleted conversation" error
  const hasConversationError = conversationError !== null;
  // I MessageDropdown - clear draft when conversation error occurs
  useEffect(() => {
    if (hasConversationError && currentConversationId) {
      // Clear draft for the problematic conversation
      clearDraftFor(currentConversationId);
    }
  }, [hasConversationError, currentConversationId]);

  // Åpne samtale fra notifikasjon
  const openConversationFromNotification = (id: number) => {
    setCurrentConversationId(id);
    setConversationVisible(true);
  };

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

    // 🎯 Hent fersk data fra store for grupper
    const conversation = groupData?.isGroup && groupData?.conversationId 
      ? useChatStore.getState().conversations.find(c => c.id === groupData.conversationId)
      : undefined;

    // 🎯 Send oppdatert user-objekt
    const updatedUser = groupData?.isGroup && conversation 
      ? {
          ...user,
          fullName: conversation.groupName || user.fullName,
          profileImageUrl: conversation.groupImageUrl || user.profileImageUrl
        }
      : user;

    useUserActionPopoverStore.getState().show({
      user: updatedUser, // 🎯 Fersk data
      position: pos,
      ...groupData,
    });
  }, []);

  // ✅ SIMPLIFIED: Handle new message dialog without overlay system
  const handleShowNewMessageDialog = (user?: UserSummaryDTO) => {
    setNewMessageInitialReceiver(user);
    setShowNewMessageDialog(true);
  };

  // ✅ SIMPLIFIED: Close new message dialog without overlay system
  const handleCloseNewMessageDialog = useCallback(() => {
    setShowNewMessageDialog(false);
    setNewMessageInitialReceiver(undefined);
  }, []);

  const [replyingTo, setReplyingTo] = useState<MessageDTO | null>(null);

  const handleReply = (message: MessageDTO) => {
    setReplyingTo(message);
    // Scroll ned til input eller fokuser på det
    // Du kan legge til smooth scroll logic her
  };

   const handleRetryMessage = useCallback(async (failedMessage: MessageDTO) => {
    if (!failedMessage.optimisticId || !conversationId) return;
    
    console.log("🔄 Retrying message:", failedMessage.optimisticId);
    
    // Marker som sender igjen
    useChatStore.getState().updateMessage(conversationId, failedMessage.id, {
      ...failedMessage,
      isSending: true,
      sendError: null
    });

    // Bygg messageData fra failed message
    const messageData = {
      text: failedMessage.text || undefined,
      files: undefined, // Files er allerede prosessert som attachments i optimistic message
      conversationId: conversationId,
      receiverId: undefined, // Du kan lagre dette i failedMessage hvis nødvendig
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
      // Hvis success, smart matching i addMessage vil håndtere resten automatisk
      
     } catch (err: unknown) { // 🔧 Endre fra 'any' til 'unknown'
      console.error("❌ Retry failed:", err);
      
      // 🔧 Type-safe error handling
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

  // 🗑️ Delete logic i MessageDropdown  
  const handleDeleteFailedMessage = useCallback((failedMessage: MessageDTO) => {
    if (!conversationId) return;
    
    console.log("🗑️ Deleting failed message:", failedMessage.optimisticId);
    
    // Fjern meldingen fra liveMessages
    const current = useChatStore.getState().liveMessages[conversationId] || [];
    const filtered = current.filter(m => m.id !== failedMessage.id);
    
    // Oppdater store direkte
    useChatStore.setState((state) => ({
      liveMessages: {
        ...state.liveMessages,
        [conversationId]: filtered
      }
    }));
  }, [conversationId]);

  useOverlayAutoClose(() => {
    setShowMessages(false);
    onCloseDropdown();
  }, 1);

  useEffect(() => {
    mainOverlay.open();
    
    return () => {
      mainOverlay.close();
    };
  }, []); // Tom array - kun mount/unmount

  // ✅ Separér store logic
  useEffect(() => {
  setShowMessages(true);
  
  return () => {
    setShowMessages(false);
    
    // 🆕 Konverter alle optimistiske meldinger til reelle ved lukking
    const state = useChatStore.getState();
    state.convertAllOptimisticToReal();
    
    // Eksisterende cleanup logic
    if (currentConversationId !== null) {
      const live = state.liveMessages[currentConversationId] ?? [];
      const cached = state.cachedMessages[currentConversationId] ?? [];

      const combined = [
        ...cached,
        ...live.filter(m => !cached.some(c => c.id === m.id))
      ];

      state.setCachedMessages(currentConversationId, combined);
      state.clearLiveMessages(currentConversationId);
    }
  };
}, []);

  // ✅ REMOVED: Sync new message dialog state - ikke nødvendig uten overlay

  // Dropdown sizing - localStorage
  useEffect(() => {
    const el = dropdownRef.current;
    if (!el) return;

    try {
      const saved = localStorage.getItem(DROPDOWN_SIZE_KEY);
      const DEFAULT_SIZE = { width: 1200, height: 600 };
      const size = saved ? JSON.parse(saved) : DEFAULT_SIZE;
      
      const validWidth = size.width && size.width > 0 ? size.width : DEFAULT_SIZE.width;
      const validHeight = size.height && size.height > 0 ? size.height : DEFAULT_SIZE.height;
      
      el.style.width = `${validWidth}px`;
      el.style.height = `${validHeight}px`;
    } catch (e) {
      console.warn("❌ OVERLAY Kunne ikke laste lagret størrelse:", e);
      const el = dropdownRef.current;
      if (el) {
        el.style.width = '1200px';
        el.style.height = '600px';
      }
    }
  }, []);

  // Resize observer
  useEffect(() => {
    const el = dropdownRef.current;
    if (!el) return;

    const rawHandleResize = (width: number, height: number) => {
      localStorage.setItem(DROPDOWN_SIZE_KEY, JSON.stringify({ width, height }));
    };

    const handleResize = debounce(rawHandleResize, 300);

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        handleResize(width, height);
      }
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Drag functionality
  const onMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    setIsDragging(true);
    offsetRef.current = {
      x: e.clientX - positionRef.current.x,
      y: e.clientY - positionRef.current.y,
    };
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const el = dropdownRef.current;
      if (!el) return;

      const dropdownWidth = el.offsetWidth;
      const dropdownHeight = el.offsetHeight;
      const windowWidth = window.innerWidth;
      const windowHeight = window.innerHeight;

      let newX = e.clientX - offsetRef.current.x;
      let newY = e.clientY - offsetRef.current.y;

      newX = Math.max(0, Math.min(newX, windowWidth - dropdownWidth));
      const minY = 48;
      newY = Math.max(minY, Math.min(newY, windowHeight - dropdownHeight));

      positionRef.current = { x: newX, y: newY };
      el.style.left = `${newX}px`;
      el.style.top = `${newY}px`;
    };

    const handleMouseUp = () => {
      if (isDragging) {
        setIsDragging(false);
        localStorage.setItem(DROPDOWN_POSITION_KEY, JSON.stringify(positionRef.current));
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging]);

  // Set initial position
  useEffect(() => {
    const el = dropdownRef.current;
    if (!el) return;

    try {
      const saved = localStorage.getItem(DROPDOWN_POSITION_KEY);
      const pos = saved ? JSON.parse(saved) : initialPosition || { x: 0, y: 0 };

      positionRef.current = pos;
      el.style.left = `${pos.x}px`;
      el.style.top = `${pos.y}px`;
    } catch (e) {
      console.warn("❌ OVERLAY Kunne ikke laste lagret posisjon:", e);
    }
  }, [initialPosition]);

  // Handle conversation selection
  const handleSelect = (id: number) => {
    const isSame = id === currentConversationId;

    // 🆕 Konverter optimistiske meldinger fra forrige samtale
    if (currentConversationId !== null && currentConversationId !== id) {
      console.log(`🔄 Switching conversation: converting optimistic messages from ${currentConversationId}`);
      useChatStore.getState().convertOptimisticToReal(currentConversationId);
    }

    if (isSame) {
      // 🆕 Konverter optimistiske meldinger ved toggle av samme samtale
      if (currentConversationId !== null) {
        useChatStore.getState().convertOptimisticToReal(currentConversationId);
      }
      
      setCurrentConversationId(null);
      setConversationVisible((prev) => !prev);
      return;
    }

    setConversationError(null);

    const state = useChatStore.getState();
    const isPending = state.pendingMessageRequests.some((r) => r.conversationId === id);

    state.setPendingLockedConversationId(isPending ? id : null);
    state.setCurrentConversationId(id);
    setConversationVisible(true);
  };


  return (
    <div
      ref={(el) => {
        dropdownRef.current = el; // For localStorage funksjonalitet
        mainOverlay.ref(el); // ✅ For overlay system
      }}
      className="fixed right-0 top-12 bg-white dark:bg-[#1e2122] text-black dark:text-white rounded-lg shadow-md max-w-[100vw] border-2 border-[#1C6B1C] overflow-hidden resize"
      style={{
        minWidth: 600,
        minHeight: 400,
        maxWidth: 2000,
        maxHeight: 1000,
        left: positionRef.current.x,
        top: positionRef.current.y,
        zIndex: mainOverlay.zIndex,
      }}
    >
      {/* Header */}
      <div  
        className="bg-[#1C6B1C] text-white px-4 py-2 flex justify-between items-center cursor-move select-none w-full"           
        onMouseDown={onMouseDown}
      >
        <div className="font-semibold">Messages</div>
        <div className="flex gap-6">
          <button
            className="text-white hover:text-gray-200"
            onClick={() => {
              localStorage.removeItem("messageDropdownSize");
              localStorage.removeItem("messageDropdownPosition");
              window.location.reload();
            }}
            title="Reset position and size"
          >
            ⟳
          </button>
          <button
            className="text-white hover:text-gray-200"
            onClick={() => {
              setShowMessages(false);
              onCloseDropdown();
            }}
            title="Close"
          >
            ✕
          </button>
        </div>
      </div>

      <div className="p-4 flex h-full overflow-hidden">
        {/* Venstre kolonne */}
        <div className="w-[275px] flex flex-col relative overflow-hidden">
          {/* Pending requests */}
          {shouldShowPendingSection && (
            <div className="shrink-0">
              <PendingRequestsList 
                limit={2} 
                onSelectConversation={handleSelect} 
                showMoreLink={true} 
              />
              <hr className="my-2 w-3/4 mx-auto border-y border-gray-300 dark:border-[#1C6B1C]" />
            </div>
          )}

          {/* Conversation list */}
          <div className="flex-1 min-h-0">
            {searchQuery.trim() && (
              <div className="px-2 py-1">
                {searchLoading ? (
                  <Spinner size={24} borderSize={3} text="Laster søkeresultater..." />
                ) : searchResults.length === 0 ? (
                  <p className="text-sm text-gray-500 mt-2 text-center">No conversations found.</p>
                ) : null}
              </div>
            )}
            <ConversationList
              conversations={searchQuery.trim() ? searchResults : undefined}
              selectedId={currentConversationId}
              onSelect={handleSelect}
              currentUser={currentUser}
            />
          </div>

          {/* Search input */}
          <div className="shrink-0 px-2 mt-3">
            <input
              type="text"
              className="w-full max-w-[250px] px-3 py-1 border border-[#1C6B1C] rounded text-sm focus:outline-none" 
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* New message button */}
          <div className="shrink-0 p-4 mb-4">
            <ProfileNavButton
              text="✚"
              variant="iconOnly"
              onClick={() => handleShowNewMessageDialog()}
            />
          </div>
        </div>

        {/* Høyre kolonne */}
        <div className="flex-1 flex flex-col h-full">
          {conversationVisible && currentConversationId ? (
            <div className="flex-1 flex flex-col h-full">
              {/* Warning banners */}
              {currentConversation?.isPendingApproval && currentConversationId !== pendingLockedConversationId && (
                <div className="bg-yellow-300 border border-yellow-400 text-yellow-800 px-4 py-2 mb-2 rounded text-sm text-center">
                  Message request sent. You can send a maximum of 5 messages the receiver will be able to see.
                </div>
              )}

              {pending.some((r) => r.conversationId === currentConversationId) &&
                currentConversationId === pendingLockedConversationId && (
                  <div className="bg-yellow-300 border border-yellow-400 text-yellow-800 px-4 py-2 mb-2 rounded text-sm text-center">
                    Approve the conversation to start sending messages.
                  </div>
              )}

              {/* Message list */}
              <div className="flex-1 min-h-0 overflow-auto">
                <MessageList
                  key={`${currentConversationId}-${conversationVisible}`}
                  currentUser={currentUser}
                  onShowUserPopover={showUserPopover}
                  conversationVisible={conversationVisible}
                  onScrollPositionChange={setAtBottom}
                  onReply={handleReply}
                  onConversationError={setConversationError}
                  onRetryMessage={handleRetryMessage} // Send retry function
                  onDeleteFailedMessage={handleDeleteFailedMessage}
                />
              </div>

              {/* Message input */}
              <div className="shrink-0 mt-2 mb-10">
                <MessageInput
                  receiverId={undefined}
                  onMessageSent={(message) => {
                    console.log("📤 OVERLAY Ny melding sendt:", message);
                    setReplyingTo(null);
                  }}
                  atBottom={atBottom}
                  onShowUserPopover={showUserPopover}
                  replyingTo={replyingTo}
                  onClearReply={() => setReplyingTo(null)}
                  isDisabled={hasConversationError} // 🆕 Disable for any conversation error
                  hideToolbar={hasConversationError}
                  conversationError={conversationError}
                />
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col h-full pb-10 pr-2">
              <NotificationsPanel onOpenConversation={openConversationFromNotification} />
            </div>
          )}
        </div>
      </div>

      {/* ✅ SIMPLIFIED: New Message Dialog without overlay system - render directly */}
      {showNewMessageDialog && createPortal(
        <NewMessageWindow
          initialReceiver={newMessageInitialReceiver}
          initialPosition={{ x: 400, y: 200 }}
          onClose={handleCloseNewMessageDialog}
          useOverlaySystem={false} // ✅ Disable overlay system since we're already in an overlay
          onMessageSent={(message: MessageDTO) => {
            console.log("📤 OVERLAY Message sent from window:", message);
            handleCloseNewMessageDialog();
          }}
          onGroupCreated={(response: SendGroupRequestsResponseDTO) => {
            console.log("👥 OVERLAY Group created from window:", response);
            handleCloseNewMessageDialog();
          }}
        />,
        document.body
      )}
    </div>
  );
}