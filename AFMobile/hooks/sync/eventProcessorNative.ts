import { SyncEventDTO } from '@shared/types/sync/SyncEventDTO';
import { handleMessageSync } from './handlers/messageSyncHandlers';
import { useChatStore } from "@/store/useChatStore";
import { useUserCacheStore } from '@/store/useUserCacheStore';
import { handleNotificationCreated } from './handlers/handleNotificationCreated';
import { handleGroupInfoUpdated } from './handlers/handleGroupInfoUpdated';
import { useNotificationStore } from '@/store/useNotificationStore';
import { NotificationDTO } from '@shared/types/NotificationEventDTO';
import { useMessageNotificationStore } from '@/store/useMessageNotificationStore';

export async function processSyncEventNative(event: SyncEventDTO): Promise<void> {
  const eventData = JSON.parse(event.eventData);
  console.log(`🔄 Processing sync event: ${event.eventType}`, eventData);
  const currentUserId = useUserCacheStore.getState().currentUser?.id ?? null;
  const { updateMessageReactions, addConversation } = useChatStore.getState();
  const { updateUser, setUser } = useUserCacheStore.getState();
  
  
  switch (event.eventType) {
    // Message events 
    // NEW_MESSAGE sender med hele convDTO og messageDTO slik at vi legger inn samtalen hvis den ikke er i store, og vi legger inn meldingen. -- FERDIG BACKEND OG FRONTEND!
    case 'NEW_MESSAGE':
    case 'CONVERSATION_CREATED': { // Brukes når vi oppretter en samtale/gruppe. Kun creator får denne, og vi legger til systemmeldingen etter samtalen -- FERDIG BACKEND OG FRONTEND!!
      // Hent message og conversation fra forskjellige strukturer
      const { message, systemMessage, conversation, conversationData } = eventData;
      const { removePendingRequest, addConversation } = useChatStore.getState();
      
      const conversationToUse = conversation || conversationData;
      
      if (conversationToUse) {
        // 🎯 Fjern fra pending hvis den finnes der (når samtale godkjennes)
        removePendingRequest(conversationToUse.id);
        
        // Legg til i conversations
        addConversation(conversationToUse);
      }
      
      // Håndter meldinger som før...
      const messages = [];
      if (systemMessage) messages.push(systemMessage);
      if (message) messages.push(message);
      
      if (messages.length > 0) {
        await handleMessageSync(messages, conversationToUse);
      }
      break;
    }
    case 'CONVERSATION_RESTORED': // Legger inn samtalen stille i bakgrunn hvis en bruker har opprettet igjen på andre enheter -- FERDIG BACKEND OG FRONTEND!
      addConversation(eventData);     
      break; 
    case 'MESSAGE_DELETED': { // Store endrer isDeleted på gjeldene melding for å opdpatere UIen. -- FERDIG BACKEND OG FRONTEND!
      const { messageId, conversationId } = eventData;
      useChatStore.getState().softDeleteMessage(conversationId, messageId);
      break;
    }
    case 'REACTION': {
      const { reaction, conversation } = eventData;
      // 1. Oppdater reaction på meldingen
      updateMessageReactions(reaction);
      
      // 2. Oppdater conversation (timestamp + plassering i liste)
      addConversation(conversation);
      break;
    }
      // Når vi mottar en MessageRequest fra en annen bruker. legger inn i pending listen. -- FERDIG BACKEND OG FRONTEND!
    case 'REQUEST_RECEIVED': {
      const { groupRequestData, messageRequestData, systemMessage, message } = eventData;
      const { addPendingRequest, addMessageOptimistic: addMessage, conversations } = useChatStore.getState();
      
      const requestData = groupRequestData || messageRequestData;
      
      if (requestData) {
        // 🎯 Sjekk om samtalen allerede eksisterer i conversations
        const conversationExists = conversations.some(conv => 
          conv.id === requestData.conversationId
        );
        
        // Kun legg til i pending hvis samtalen IKKE allerede eksisterer
        if (!conversationExists) {
          addPendingRequest(requestData);
          console.log('📥 Added request to pending list');
        } else {
          console.log('⚠️ Request received for existing conversation - ignoring pending request');
        }
      }
      
      // Legg til meldinger uansett (systemMessage og message kan være relevante)
      const messages = [systemMessage, message].filter(Boolean);
      for (const msg of messages) {
        await addMessage(msg);
      }
      break;
    }
    case 'GROUP_INFO_UPDATED': {
        await handleGroupInfoUpdated(eventData, currentUserId);
        break;
    }
    case 'CONVERSATION_LEFT': // Brukes når vi forlater en gruppesamtale. Sletter den fra samtale listen -- FERDIG BACKEND OG FRONTEND!
        const { removeConversation, removePendingRequest } = useChatStore.getState();
        removeConversation(eventData);
        removePendingRequest(eventData);
        break;
        
    
    // Friend events -- Oppdaterer frontend med den nye venneforespørselen -- FERDIG BACKEND OG FRONTEND!
    case 'FRIEND_REQUEST_RECEIVED': {
      const { addFriendRequest } = useNotificationStore.getState();
      addFriendRequest(eventData); // eventData er hele FriendInvitationDTO
      console.log('🤝 Friend request received:', eventData);
      break;
    }
    case 'FRIEND_ADDED': {
      const { removeFriendRequest } = useNotificationStore.getState();
      
      // Legg til/oppdater venn i user cache
      updateUser(eventData.friendUser.id, {
        ...eventData.friendUser,
        isFriend: true,  // Sikre at relationship status er satt/
      });
      
      // Fjern friend request hvis den finnes
      const friendRequests = useNotificationStore.getState().friendRequests;
      const existingRequest = friendRequests.find(fr => 
        fr.userSummary?.id === eventData.friendUser.id
      );
      
      if (existingRequest) {
        removeFriendRequest(existingRequest.id);
        console.log('🤝 Removed friend request after becoming friends');
      }
      
      console.log('🤝 Friend added:', eventData.friendUser.fullName);
      break;
    }

    case 'FRIEND_REQUEST_DECLINED': { // -- FERDIG FRONTEND TIL BACKEND!!
      const { removeFriendRequest } = useNotificationStore.getState(); // Sender kun med pendingInv ID og sletter den fra listen
      removeFriendRequest(eventData as number);
      console.log('❌ Friend request declined and removed from pending list');
      break;
    }
    case 'FRIEND_REMOVED': { // Sender med Id-en til vennen vi skal sette som ikke venn i UserSummary-listen -- FERDIG FRONTEND TIL BACKEND!!
      updateUser(eventData.friendId, {
        isFriend: false // 🎯 Sett som ikke-venn
      });
      console.log('💔 Friend removed from user cache:', eventData.friendId);
      break;
    }
    case 'USER_PROFILE_UPDATED': {
      const { updateUser } = useUserCacheStore.getState();
      
      // Oppdater kun de endrede feltene (f.eks. fullName eller profileImageUrl)
      updateUser(eventData.userId, eventData.updatedValues);
      
      console.log('👤 User profile updated:', eventData.updatedFields, eventData.updatedValues);
      break;
    }
    case 'USER_BLOCKED_UPDATED': // Sender med hele USerSummaryen til den som blokkerte/unblokkerte brukeren eller som brukeren har blokkert/unblokkert selv -- FERDIG FRONTEND TIL BACKEND!!
      setUser(eventData);
      break;

    // Notificaitons
    case 'MESSAGE_NOTIFICATION_CREATED': // Notificaitons created. Tar imot en notification laget i backend og legger den inn i notifications i frontend. Vanlig og gruppe. -- FERDIG BACKEND OG FRONTEND!
      await handleNotificationCreated(eventData);
      break;

    case 'MARK_AS_READ': {
      const { conversationId } = eventData;
      
      // Oppdater notifikasjoner
      const { markAsReadForConversation } = useMessageNotificationStore.getState();
      markAsReadForConversation(conversationId);
      
      // Oppdater unread conversation list
      const { markConversationAsReadLocally } = useChatStore.getState();
      markConversationAsReadLocally(conversationId);
      
      console.log('📖 Marked conversation as read locally:', conversationId);
      break;
    }

    case 'MARK_ALL_AS_READ': {
      // MessageNotificationStore tar seg av alt - både notifikasjoner og ChatStore oppdatering
      const { markAllAsRead } = useMessageNotificationStore.getState();
      markAllAsRead();
      
      console.log('📖 Marked all notifications as read locally');
      break;
    }

    case 'NOTIFICATION_CREATED': {
      const { addNotification } = useNotificationStore.getState();
      addNotification(eventData as NotificationDTO);
      console.log('🔔 Notification added to store:', eventData);
      break;
    }


    default:
      console.warn('Unknown sync event type:', event.eventType);
  }
}

// Systemmeldinger ferdig: ApprovedMessageRequest