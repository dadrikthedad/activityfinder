import { useCallback } from 'react';
import { CriticalBootstrapResponseDTO } from '@shared/types/bootstrap/CriticalBootstrapResponseDTO';
import { SecondaryBootstrapResponseDTO } from '@shared/types/bootstrap/SecondaryBootstrapResponseDTO';
import { useBootstrapStore } from '@/store/useBootstrapStore';
import { useChatStore } from '@/store/useChatStore';
import { useMessageNotificationStore } from '@/store/useMessageNotificationStore';
import { mergeMessageNotifications, setMessageNotificationsInStore } from '@/utils/messages/MessageNotificationFunctions';
import { useUserCacheStore } from '@/store/useUserCacheStore';
import { useNotificationStore } from '@/store/useNotificationStore';

export const useBootstrapDistributor = () => {
  const { setCriticalData, setSecondaryData } = useBootstrapStore();
 
  const {
    setConversations,
    setHasLoadedConversations,
    setCachedMessages,
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
    setCurrentUser,
    setSettings,
    cacheUsersFromCriticalBootstrap,
    setUsers
  } = useUserCacheStore();

  // ✅ NY FUNKSJON - Marker cached data som loaded
  const markCacheAsLoaded = useCallback(() => {
    console.log("📋 Marking cached data as loaded (from cache)...");
    
    // Critical flags
    setHasLoadedConversations(true);
    
    // Secondary flags  
    setHasLoadedUnreadConversationIds(true);
    setHasLoadedPendingRequests(true); // ✅ DETTE VAR PROBLEMET!
    setHasLoadedMessageNotifications(true);
    setHasLoadedFriendRequests(true);
    setHasLoadedNotifications(true);
    
    console.log("✅ All loading flags set to true (cache mode)");
  }, [
    setHasLoadedConversations,
    setHasLoadedUnreadConversationIds,
    setHasLoadedPendingRequests,
    setHasLoadedMessageNotifications,
    setHasLoadedFriendRequests,
    setHasLoadedNotifications
  ]);

  const distributeCriticalData = useCallback((data: CriticalBootstrapResponseDTO) => {
    // console.log("📦 Distributing critical bootstrap data...");
   
    // 1. SyncToken til BootstrapStore
    setCriticalData(data);
    
    // 2. Current user til UserCacheStore
    setCurrentUser(data.user);

    // 3. Conversations direkte til ChatStore
    setConversations(data.recentConversations);
    setHasLoadedConversations(true);

    // 4. Cache messages for each conversation
    if (data.conversationMessages) {
      Object.entries(data.conversationMessages).forEach(([conversationId, messages]) => {
        const convId = Number(conversationId);
        if (messages && messages.length > 0) {
          setCachedMessages(convId, messages);
        }
      });
      
      // console.log(`✅ Cached messages for ${Object.keys(data.conversationMessages).length} conversations`);
    }

    // 5. Cache conversation participants i UserCache
    cacheUsersFromCriticalBootstrap(data);
   
    console.log("✅ Critical data distributed:", {
      user: data.user.fullName,
      conversations: data.recentConversations.length,
      conversationMessages: Object.keys(data.conversationMessages || {}).length,
      totalMessages: Object.values(data.conversationMessages || {}).reduce((sum, msgs) => sum + msgs.length, 0),
      stores: "BootstrapStore (syncToken) + UserCacheStore (currentUser) + ChatStore (conversations + messages) + UserCache"
    });
  }, [setCriticalData, setCurrentUser, setConversations, setHasLoadedConversations, setCachedMessages, cacheUsersFromCriticalBootstrap]);

  const distributeSecondaryData = useCallback((data: SecondaryBootstrapResponseDTO) => {
    // console.log("📦 Distributing secondary bootstrap data...");
   
    // 1. Settings til UserCacheStore
    setSettings(data.settings);
    
    // 2. Bootstrap timestamps til BootstrapStore
    setSecondaryData(data);
   
    // 3. Chat-relatert data direkte til ChatStore
    setUnreadConversationIds(data.unreadConversationIds);
    setHasLoadedUnreadConversationIds(true);
   
    // 4. Pending message requests til ChatStore
    setPendingMessageRequests(data.pendingMessageRequests);
    setHasLoadedPendingRequests(true);
    setCachedPendingRequests(data.pendingMessageRequests);

    // 5. MessageNotifications til MessageNotificationStore
    if (data.recentMessageNotifications && data.recentMessageNotifications.length > 0) {
      const merged = mergeMessageNotifications(data.recentMessageNotifications);
      setMessageNotificationsInStore(merged, "bootstrap");
    } else {
      setHasLoadedMessageNotifications(true);
      console.log("📨 Ingen message notifications mottatt, men marker som loaded");
    }

    // 6. Friend invitations til NotificationStore
    if (data.pendingFriendInvitations && data.pendingFriendInvitations.length > 0) {
      setFriendRequests(data.pendingFriendInvitations);
      setHasLoadedFriendRequests(true);

      const { setFriendRequestTotalCount } = useNotificationStore.getState();
      setFriendRequestTotalCount(data.pendingFriendInvitations.length);

      // console.log("👥 Friend requests satt i NotificationStore:", data.pendingFriendInvitations.length);
    } else {
      setHasLoadedFriendRequests(true);
      // console.log("👥 Ingen friend requests mottatt, men marker som loaded");
    }

    // 7. App notifications til NotificationStore
    if (data.recentNotifications && data.recentNotifications.length > 0) {
      setNotifications(data.recentNotifications);
      setHasLoadedNotifications(true);
      // console.log("🔔 App notifications satt i NotificationStore:", data.recentNotifications.length);
    } else {
      setHasLoadedNotifications(true);
      // console.log("🔔 Ingen app notifications mottatt, men marker som loaded");
    }

    // 8. Cache all users med relationships i UserCache
    // console.log("🔍 DEBUG: About to process allUserSummaries...");
    // console.log("🔍 DEBUG: allUserSummaries data:", {
    //   exists: !!data.allUserSummaries,
    //   type: typeof data.allUserSummaries,
    //   length: data.allUserSummaries?.length,
    //   isArray: Array.isArray(data.allUserSummaries),
    //   firstUser: data.allUserSummaries?.[0]
    // });

    if (data.allUserSummaries && data.allUserSummaries.length > 0) {
     //  console.log("🚀 PROCESSING allUserSummaries - calling setUsers...");
      setUsers(data.allUserSummaries);
     //  console.log("🤝 User relationships cached:", {
     //    total: data.allUserSummaries.length,
     //    friends: data.allUserSummaries.filter(u => u.isFriend).length,
     //    blocked: data.allUserSummaries.filter(u => u.isBlocked).length,
     //    sampleUser: data.allUserSummaries[0]
     //  });
    } else {
      // console.log("🤝 No user relationships to cache - allUserSummaries is empty or undefined");
    }

    console.log("✅ Secondary data distributed:", {
      settings: data.settings.language,
      unreadConversations: data.unreadConversationIds.length,
      pendingRequests: data.pendingMessageRequests.length,
      messageNotifications: data.recentMessageNotifications?.length || 0,
      pendingFriendInvitations: data.pendingFriendInvitations.length,
      appNotifications: data.recentNotifications?.length || 0,
      allUserSummaries: data.allUserSummaries?.length || 0,
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
    setSettings
  ]);

  return {
    distributeCriticalData,
    distributeSecondaryData,
    markCacheAsLoaded, // ✅ EKSPORTER den nye funksjonen
  };
};