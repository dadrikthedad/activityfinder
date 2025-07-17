import { useCallback } from 'react';
import { CriticalBootstrapResponseDTO } from '@/types/bootstrap/CriticalBootstrapResponseDTO';
import { SecondaryBootstrapResponseDTO } from '@/types/bootstrap/SecondaryBootstrapResponseDTO';
import { useBootstrapStore } from '@/store/useBootstrapStore';
import { useChatStore } from '@/store/useChatStore';
import { useMessageNotificationStore } from '@/store/useMessageNotificationStore';
import { mergeMessageNotifications, setMessageNotificationsInStore } from '@/functions/messages/MessageNotificationFunctions';

export const useBootstrapDistributor = () => {
  const { setCriticalData, setSecondaryData } = useBootstrapStore();
 
  const {
    setConversations,
    setHasLoadedConversations,
    setUnreadConversationIds,
    setHasLoadedUnreadConversationIds,
    setPendingMessageRequests,
    setHasLoadedPendingRequests,
    setCachedPendingRequests,
  } = useChatStore();

  // 🆕 LEGG TIL MessageNotificationStore
  const {
    setNotifications: setMessageNotifications,
    setHasLoadedNotifications: setHasLoadedMessageNotifications,
  } = useMessageNotificationStore();

  const distributeCriticalData = useCallback((data: CriticalBootstrapResponseDTO) => {
    console.log("📦 Distributing critical bootstrap data...");
   
    // 1. User + syncToken til BootstrapStore
    setCriticalData(data);
   
    // 2. Conversations direkte til ChatStore
    setConversations(data.recentConversations);
    setHasLoadedConversations(true);
   
    console.log("✅ Critical data distributed:", {
      user: data.user.fullName,
      conversations: data.recentConversations.length,
      stores: "BootstrapStore + ChatStore"
    });
  }, [setCriticalData, setConversations, setHasLoadedConversations]);

  const distributeSecondaryData = useCallback((data: SecondaryBootstrapResponseDTO) => {
    console.log("📦 Distributing secondary bootstrap data...");
   
    // 1. Friends/Settings/Blocked til BootstrapStore
    setSecondaryData(data);
   
    // 2. Chat-relatert data direkte til ChatStore
    setUnreadConversationIds(data.unreadConversationIds);
    setHasLoadedUnreadConversationIds(true);
   
    // 3. Pending message requests til ChatStore
    setPendingMessageRequests(data.pendingMessageRequests);
    setHasLoadedPendingRequests(true);
    setCachedPendingRequests(data.pendingMessageRequests);

    // 🆕 4. MessageNotifications til MessageNotificationStore
    if (data.recentNotifications && data.recentNotifications.length > 0) {
      // Gjenbruk hjelpefunksjon for konsistent logikk
      const merged = mergeMessageNotifications(data.recentNotifications);
      setMessageNotificationsInStore(merged, "bootstrap");
    } else {
      // Fortsatt marker som loaded selv om det er tomt
      setHasLoadedMessageNotifications(true);
      console.log("📨 Ingen message notifications mottatt, men marker som loaded");
    }
   
    console.log("✅ Secondary data distributed:", {
      friends: data.friends.length,
      settings: data.settings.language,
      unreadConversations: data.unreadConversationIds.length,
      pendingRequests: data.pendingMessageRequests.length,
      messageNotifications: data.recentNotifications?.length || 0, 
      stores: "BootstrapStore + ChatStore + MessageNotificationStore" 
    });
  }, [
    setSecondaryData,
    setUnreadConversationIds,
    setHasLoadedUnreadConversationIds,
    setPendingMessageRequests,
    setHasLoadedPendingRequests,
    setCachedPendingRequests,
    setMessageNotifications,
    setHasLoadedMessageNotifications, 
  ]);

  return {
    distributeCriticalData,
    distributeSecondaryData,
  };
};