"use client";
import { useEffect } from "react";
import { showNotificationToast } from "@/components/toast/Toast";
import { NotificationType } from "@/types/MessageNotificationDTO";
import { useGetDeletedConversations } from "@/hooks/messages/useGetDeletedConversations";
import { useGetRejectedConversations } from "@/hooks/messages/useGetRejectedConversations";
import { useRestoreConversation } from "@/hooks/messages/useRestoreConversation";
import { useApproveMessageRequest } from "@/hooks/messages/useApproveMessageRequest";

export default function ChatPage() {
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

  const getOtherParticipant = (participants: any[], currentUserId?: number) => {
    return participants.find(p => p.id !== currentUserId) || participants[0];
  };

  return (
    <div className="px-6 py-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-8">Samtale Administration</h1>
      
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
            const otherParticipant = getOtherParticipant(conversation.participants);
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
        
        {rejectedLoading && (
          <div className="text-gray-600 dark:text-gray-400">Laster avslåtte samtaler...</div>
        )}
        
        {rejectedError && (
          <div className="text-red-600 dark:text-red-400 mb-4">
            Feil ved lasting: {rejectedError}
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
                      {conversation.isGroup ? 'Gruppe' : '1-1'} • ID: {conversation.id}
                    </div>
                  </div>
                </div>
                
                <button
                  onClick={() => handleApprove(conversation.id)}
                  disabled={isApproving}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg font-medium transition-colors disabled:cursor-not-allowed"
                >
                  {isApproving ? 'Godkjenner...' : 'Godkjenn'}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}