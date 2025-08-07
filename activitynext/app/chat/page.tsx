"use client";
import { useEffect, useState } from "react";
import { showNotificationToast } from "@/components/toast/Toast";
import { NotificationType } from "@shared/types/MessageNotificationDTO";
import { useGetDeletedConversations } from "@/hooks/messages/useGetDeletedConversations";
import { useGetRejectedConversations } from "@/hooks/messages/useGetRejectedConversations";
import { useRestoreConversation } from "@/hooks/messages/useRestoreConversation";
import { useApproveMessageRequest } from "@/hooks/messages/useApproveMessageRequest";
import { useDeleteGroupRequest } from "@/hooks/messages/useDeleteGroupRequest";
import { UserSummaryDTO } from "@shared/types/UserSummaryDTO";
import { useAuth } from "@/context/AuthContext";
import { useBootstrap } from "@/hooks/bootstrap/useBootstrap"; // 👈 LEGG TIL

export default function ChatPage() {
  const [deletedGroupRequestMessage, setDeletedGroupRequestMessage] = useState<string | null>(null);
  
  // 🆕 Bootstrap data
  const { 
    user, 
    settings, 
    isBootstrapped, 
    criticalLoading, 
    secondaryLoading,
    criticalError,
    secondaryError,
    syncToken 
  } = useBootstrap();
  
  const { 
    deletedConversations, 
    isLoading: deletedLoading, 
    error: deletedError, 
    refetch: refetchDeleted 
  } = useGetDeletedConversations();
  
  const { 
    rejectedConversations, 
    isLoading: rejectedLoading, 
    error: rejectedError, 
    refetch: refetchRejected 
  } = useGetRejectedConversations();
  
  const { restoreConversationMutation, isRestoring } = useRestoreConversation();
  const { approve, loading: isApproving } = useApproveMessageRequest();
  const { deleteRequest, isLoading: isDeletingGroupRequest, error: deleteError } = useDeleteGroupRequest();

  const { userId: currentUserId } = useAuth();

  useEffect(() => {
    const timeout = setTimeout(() => {
      showNotificationToast({
        senderName: "Demo Bruker",
        messagePreview: "Se hvordan denne toasten ser ut",
        conversationId: 42,
        type: NotificationType.MessageReaction,
        reactionEmoji: "🔥",
      });
    }, 100);
    return () => clearTimeout(timeout);
  }, []);

  const handleRestore = async (conversationId: number) => {
    try {
      await restoreConversationMutation(conversationId);
      await refetchDeleted();
      console.log('✅ Samtale gjenopprettet!');
    } catch (error) {
      console.error('❌ Kunne ikke gjenopprette samtale:', error);
    }
  };

  const handleApprove = async (conversationId: number) => {
    try {
      await approve(conversationId);
      await refetchRejected();
      console.log('✅ Samtale godkjent!');
    } catch (error) {
      console.error('❌ Kunne ikke godkjenne samtale:', error);
    }
  };

  const handleDeleteGroupRequest = async (conversationId: number) => {
    try {
      const result = await deleteRequest(conversationId);
      await refetchRejected();
      
      if (result?.message) {
        setDeletedGroupRequestMessage(result.message);
        setTimeout(() => setDeletedGroupRequestMessage(null), 5000);
      }
      
      console.log('✅ GroupRequest slettet:', result?.message);
    } catch (error) {
      console.error('❌ Kunne ikke slette GroupRequest:', error);
    }
  };

  const getOtherParticipant = (participants: UserSummaryDTO[], currentUserId?: number): UserSummaryDTO | null => {
    if (!participants?.length) {
      return null;
    }

    if (!currentUserId) {
      return participants[0];
    }

    const otherParticipant = participants.find(p => p.id !== currentUserId);
    return otherParticipant || participants[0];
  };

  return (
    <div className="px-6 py-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-8">Samtale Administration</h1>
      
      {/* 🆕 Bootstrap Debug Section */}
      <div className="mb-12 p-6 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
        <h2 className="text-xl font-semibold mb-4 text-blue-800 dark:text-blue-200 flex items-center gap-2">
          🚀 Bootstrap Status
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          {/* Status indicators */}
          <div className="space-y-2">
            <div className={`flex items-center gap-2 ${isBootstrapped ? 'text-green-600 dark:text-green-400' : 'text-orange-600 dark:text-orange-400'}`}>
              <div className={`w-2 h-2 rounded-full ${isBootstrapped ? 'bg-green-500' : 'bg-orange-500'}`}></div>
              <span className="font-medium">
                {isBootstrapped ? '✅ Bootstrap Complete' : '⏳ Bootstrap Pending'}
              </span>
            </div>
            
            <div className={`flex items-center gap-2 ${criticalLoading ? 'text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400'}`}>
              <div className={`w-2 h-2 rounded-full ${criticalLoading ? 'bg-blue-500' : 'bg-gray-400'}`}></div>
              <span>Critical Loading: {criticalLoading ? 'Yes' : 'No'}</span>
            </div>
            
            <div className={`flex items-center gap-2 ${secondaryLoading ? 'text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400'}`}>
              <div className={`w-2 h-2 rounded-full ${secondaryLoading ? 'bg-blue-500' : 'bg-gray-400'}`}></div>
              <span>Secondary Loading: {secondaryLoading ? 'Yes' : 'No'}</span>
            </div>
          </div>
          
          {/* Data overview */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
              <span>👤 User:</span>
              <span className="font-medium">{user?.fullName || 'Not loaded'}</span>
            </div>
            

            
            <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
              <span>🌐 Language:</span>
              <span className="font-medium">{settings?.language || 'Not loaded'}</span>
            </div>
          </div>
        </div>
        
        {/* Error states */}
        {(criticalError || secondaryError) && (
          <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded">
            {criticalError && (
              <div className="text-red-600 dark:text-red-400 text-sm">
                <strong>Critical Error:</strong> {criticalError}
              </div>
            )}
            {secondaryError && (
              <div className="text-red-600 dark:text-red-400 text-sm">
                <strong>Secondary Error:</strong> {secondaryError}
              </div>
            )}
          </div>
        )}
        
        {/* Sync token info */}
        {syncToken && (
          <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-800 rounded border">
            <div className="text-xs text-gray-600 dark:text-gray-400">
              <strong>Sync Token:</strong> {syncToken.substring(0, 20)}...
            </div>
          </div>
        )}
      </div>
      
      {/* Existing content continues... */}
      
      {/* Deleted Conversations Section */}
      <div className="mb-12">
        <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-200">
          🗑️ Slettede Samtaler ({deletedConversations.length})
        </h2>
        
        {deletedLoading && (
          <div className="text-gray-600 dark:text-gray-400">Laster slettede samtaler...</div>
        )}
        
        {deletedError && (
          <div className="text-red-600 dark:text-red-400 mb-4">
            Feil ved lasting: {deletedError}
          </div>
        )}
        
        {!deletedLoading && deletedConversations.length === 0 && (
          <div className="text-gray-500 dark:text-gray-400 italic">
            Ingen slettede samtaler funnet.
          </div>
        )}
        
        <div className="space-y-3">
          {deletedConversations.map((conversation) => {
            const otherParticipant = getOtherParticipant(conversation.participants, currentUserId ?? undefined);
            return (
              <div
                key={conversation.id}
                className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
              >
                <div className="flex items-center gap-3">
                  <img
                    src={otherParticipant?.profileImageUrl || "/default-avatar.png"}
                    alt={otherParticipant?.fullName || "Unknown"}
                    className="w-12 h-12 rounded-full object-cover"
                  />
                  <div>
                    <div className="font-medium text-gray-900 dark:text-gray-100">
                      {otherParticipant?.fullName || "Unknown User"}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      Conversation ID: {conversation.id}
                    </div>
                  </div>
                </div>
                
                <button
                  onClick={() => handleRestore(conversation.id)}
                  disabled={isRestoring}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white rounded-lg font-medium transition-colors disabled:cursor-not-allowed"
                >
                  {isRestoring ? 'Gjenoppretter...' : 'Gjenopprett'}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Rejected Conversations Section */}
      <div>
        <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-200">
          ❌ Avslåtte Samtaler ({rejectedConversations.length})
        </h2>
        
        {deletedGroupRequestMessage && (
          <div className="mb-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span className="text-green-800 dark:text-green-200 font-medium">
                {deletedGroupRequestMessage}
              </span>
            </div>
          </div>
        )}
        
        {rejectedLoading && (
          <div className="text-gray-600 dark:text-gray-400">Laster avslåtte samtaler...</div>
        )}
        
        {rejectedError && (
          <div className="text-red-600 dark:text-red-400 mb-4">
            Feil ved lasting: {rejectedError}
          </div>
        )}

        {deleteError && (
          <div className="text-red-600 dark:text-red-400 mb-4">
            Feil ved sletting av GroupRequest: {deleteError}
          </div>
        )}
        
        {!rejectedLoading && rejectedConversations.length === 0 && (
          <div className="text-gray-500 dark:text-gray-400 italic">
            Ingen avslåtte samtaler funnet.
          </div>
        )}
        
        <div className="space-y-3">
          {rejectedConversations.map((conversation) => {
            const otherParticipant = getOtherParticipant(conversation.participants);
            const isGroup = conversation.isGroup;
            
            return (
              <div
                key={conversation.id}
                className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
              >
                <div className="flex items-center gap-3">
                  <img
                    src={
                      isGroup 
                        ? conversation.groupImageUrl || "/default-group-avatar.png"
                        : otherParticipant?.profileImageUrl || "/default-avatar.png"
                    }
                    alt={
                      isGroup 
                        ? conversation.groupName || "Group"
                        : otherParticipant?.fullName || "Unknown"
                    }
                    className="w-12 h-12 rounded-full object-cover"
                  />
                  <div>
                    <div className="font-medium text-gray-900 dark:text-gray-100">
                      {isGroup 
                        ? conversation.groupName || "Unnamed Group"
                        : otherParticipant?.fullName || "Unknown User"
                      }
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      {conversation.isGroup ? 'Gruppe' : '1-1'} • ID: {conversation.id}
                    </div>
                  </div>
                </div>
                
                <div className="flex gap-2">
                  {isGroup ? (
                    <button
                      onClick={() => handleDeleteGroupRequest(conversation.id)}
                      disabled={isDeletingGroupRequest}
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white rounded-lg font-medium transition-colors disabled:cursor-not-allowed"
                    >
                      {isDeletingGroupRequest ? 'Sletter...' : 'Slett Request'}
                    </button>
                  ) : (
                    <button
                      onClick={() => handleApprove(conversation.id)}
                      disabled={isApproving}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg font-medium transition-colors disabled:cursor-not-allowed"
                    >
                      {isApproving ? 'Godkjenner...' : 'Godkjenn'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}