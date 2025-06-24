import { useState } from 'react';
import { SendGroupRequestsDTO, SendGroupRequestsResponseDTO } from '@/types/SendGroupRequestsDTO';
import { sendGroupRequests } from '@/services/messages/groupService';
import { useConversationSyncOnMessage } from './getConversationById';
import { useChatStore } from '@/store/useChatStore';
import { updateConversationParticipants } from '@/services/helpfunctions/conversationUpdateSerivce';

interface UseGroupRequestsResult {
  sendGroupInvitations: (request: SendGroupRequestsDTO) => Promise<SendGroupRequestsResponseDTO | null>;
  isLoading: boolean;
  error: string | null;
  clearError: () => void;
}

export function useGroupRequests(): UseGroupRequestsResult {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { syncConversation } = useConversationSyncOnMessage();
  const { setCurrentConversationId } = useChatStore();

  const sendGroupInvitations = async (request: SendGroupRequestsDTO): Promise<SendGroupRequestsResponseDTO | null> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await sendGroupRequests(request);
      
      if (!response) {
        setError('Failed to send group invitations');
        return null;
      }

      console.log("✅ Gruppe-invitasjoner sendt:", response);

      // 🆕 SYNC GRUPPESAMTALEN TIL STORE
      if (response.conversationId) {
        console.log("🔄 Synkroniserer ny gruppesamtale til store:", response.conversationId);
        
        try {
          const syncedConversation = await syncConversation({ conversationId: response.conversationId });
          
          if (syncedConversation) {
            console.log("✅ Gruppesamtale synkronisert til store:", syncedConversation);
            
            // 🎯 SETT DEN NYE GRUPPESAMTALEN SOM AKTIV
            setCurrentConversationId(response.conversationId);
            console.log("🔄 Satt aktiv samtale til:", response.conversationId);
          }

          await updateConversationParticipants(response.conversationId, "After inviting users");
          
        } catch (syncError) {
          console.error("❌ Feil ved synkronisering av gruppesamtale:", syncError);
          // Fortsett likevel, siden invitasjonene er sendt
        }
      }

      return response;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
      setError(errorMessage);
      console.error("❌ Feil ved sending av gruppe-invitasjoner:", errorMessage);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const clearError = () => {
    setError(null);
  };

  return {
    sendGroupInvitations,
    isLoading,
    error,
    clearError,
  };
}