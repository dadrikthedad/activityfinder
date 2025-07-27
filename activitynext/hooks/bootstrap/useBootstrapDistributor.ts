import { useCallback } from 'react';
import { CriticalBootstrapResponseDTO } from '@/types/bootstrap/CriticalBootstrapResponseDTO';
import { SecondaryBootstrapResponseDTO } from '@/types/bootstrap/SecondaryBootstrapResponseDTO';
import { useBootstrapStore } from '@/store/useBootstrapStore';
import { useChatStore } from '@/store/useChatStore';
import { useMessageNotificationStore } from '@/store/useMessageNotificationStore';
import { mergeMessageNotifications, setMessageNotificationsInStore } from '@/functions/messages/MessageNotificationFunctions';
import { useUserCacheStore } from '@/store/useUserCacheStore';
import { useNotificationStore } from '@/store/useNotificationStore';

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

  const {
    setHasLoadedNotifications: setHasLoadedMessageNotifications,
  } = useMessageNotificationStore();

  const {
    setFriendRequests,
    setHasLoadedFriendRequests,
    setNotifications,   
    setHasLoadedNotifications
  } = useNotificationStore();

  const {
    cacheUsersFromCriticalBootstrap,
    setUsers
  } = useUserCacheStore();

  const distributeCriticalData = useCallback((data: CriticalBootstrapResponseDTO) => {
    console.log("📦 Distributing critical bootstrap data...");
   
    // 1. User + syncToken til BootstrapStore
    setCriticalData(data);
   
    // 2. Conversations direkte til ChatStore
    setConversations(data.recentConversations);
    setHasLoadedConversations(true);

    // 3. Cache conversation participants i UserCache
    cacheUsersFromCriticalBootstrap(data);
   
    console.log("✅ Critical data distributed:", {
      user: data.user.fullName,
      conversations: data.recentConversations.length,
      stores: "BootstrapStore + ChatStore + UserCache"
    });
  }, [setCriticalData, setConversations, setHasLoadedConversations, cacheUsersFromCriticalBootstrap]);

  const distributeSecondaryData = useCallback((data: SecondaryBootstrapResponseDTO) => {
    console.log("📦 Distributing secondary bootstrap data...");
   
    // 1. Settings til BootstrapStore (friends/blocked flyttet til UserCache)
    setSecondaryData(data);
   
    // 2. Chat-relatert data direkte til ChatStore
    setUnreadConversationIds(data.unreadConversationIds);
    setHasLoadedUnreadConversationIds(true);
   
    // 3. Pending message requests til ChatStore
    setPendingMessageRequests(data.pendingMessageRequests);
    setHasLoadedPendingRequests(true);
    setCachedPendingRequests(data.pendingMessageRequests);

    // 4. MessageNotifications til MessageNotificationStore
    if (data.recentMessageNotifications && data.recentMessageNotifications.length > 0) {
      // Gjenbruk hjelpefunksjon for konsistent logikk
      const merged = mergeMessageNotifications(data.recentMessageNotifications);
      setMessageNotificationsInStore(merged, "bootstrap");
    } else {
      // Fortsatt marker som loaded selv om det er tomt
      setHasLoadedMessageNotifications(true);
      console.log("📨 Ingen message notifications mottatt, men marker som loaded");
    }
    // 5. Friend invitations til NotificationStore
    if (data.pendingFriendInvitations && data.pendingFriendInvitations.length > 0) {
      setFriendRequests(data.pendingFriendInvitations);
      setHasLoadedFriendRequests(true);

      const { setFriendRequestTotalCount } = useNotificationStore.getState();
      setFriendRequestTotalCount(data.pendingFriendInvitations.length);

      console.log("👥 Friend requests satt i NotificationStore:", data.pendingFriendInvitations.length);
    } else {
      setHasLoadedFriendRequests(true);
      console.log("👥 Ingen friend requests mottatt, men marker som loaded");
    }

    // 6. App notifications til NotificationStore
    if (data.recentNotifications && data.recentNotifications.length > 0) {
      setNotifications(data.recentNotifications);
      setHasLoadedNotifications(true);
      console.log("🔔 App notifications satt i NotificationStore:", data.recentNotifications.length);
    } else {
      setHasLoadedNotifications(true);
      console.log("🔔 Ingen app notifications mottatt, men marker som loaded");
    }

    // 7. Cache all users med relationships i UserCache
      console.log("🔍 DEBUG: About to process allUserSummaries...");
      console.log("🔍 DEBUG: allUserSummaries data:", {
        exists: !!data.allUserSummaries,
        type: typeof data.allUserSummaries,
        length: data.allUserSummaries?.length,
        isArray: Array.isArray(data.allUserSummaries),
        firstUser: data.allUserSummaries?.[0]
      });

      if (data.allUserSummaries && data.allUserSummaries.length > 0) {
        console.log("🚀 PROCESSING allUserSummaries - calling setUsers...");
        setUsers(data.allUserSummaries);
        console.log("🤝 User relationships cached:", {
          total: data.allUserSummaries.length,
          friends: data.allUserSummaries.filter(u => u.isFriend).length,
          blocked: data.allUserSummaries.filter(u => u.isBlocked).length,
          sampleUser: data.allUserSummaries[0]
        });
      } else {
        console.log("🤝 No user relationships to cache - allUserSummaries is empty or undefined");
      }

      console.log("✅ Secondary data distributed:", {
        settings: data.settings.language,
        unreadConversations: data.unreadConversationIds.length,
        pendingRequests: data.pendingMessageRequests.length,
        messageNotifications: data.recentMessageNotifications?.length || 0,
        pendingFriendInvitations: data.pendingFriendInvitations.length,
        appNotifications: data.recentNotifications?.length || 0,
        allUserSummaries: data.allUserSummaries?.length || 0, // 🆕 ENDRET
        stores: "BootstrapStore + ChatStore + MessageNotificationStore + NotificationStore + UserCache" 
      });
   }, [
    setSecondaryData,
    setUnreadConversationIds,
    setHasLoadedUnreadConversationIds,
    setPendingMessageRequests,
    setHasLoadedPendingRequests,
    setCachedPendingRequests,
    setHasLoadedMessageNotifications,
    setFriendRequests,
    setHasLoadedFriendRequests,
    setNotifications,           
    setHasLoadedNotifications,
    setUsers,
  ]);

  return {
    distributeCriticalData,
    distributeSecondaryData,
  };
};