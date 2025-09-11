// hooks/bootstrap/useBootstrapDistributor.ts
import { useCallback } from 'react';
import { CriticalBootstrapResponseDTO } from '@shared/types/bootstrap/CriticalBootstrapResponseDTO';
import { SecondaryBootstrapResponseDTO } from '@shared/types/bootstrap/SecondaryBootstrapResponseDTO';
import { useBootstrapStore } from '@/store/useBootstrapStore';
import { useChatStore } from '@/store/useChatStore';
import { useMessageNotificationStore } from '@/store/useMessageNotificationStore';
import { mergeMessageNotifications, setMessageNotificationsInStore } from '@/utils/messages/MessageNotificationFunctions';
import { useUserCacheStore } from '@/store/useUserCacheStore';
import { useNotificationStore } from '@/store/useNotificationStore';
import { useBootstrapE2EEHandler } from '@/components/ende-til-ende/useBootstrapE2EEHandler';

export const useBootstrapDistributor = () => {
  const { setCriticalData, setSecondaryData } = useBootstrapStore();
  const { handleConversationMessages } = useBootstrapE2EEHandler();
 
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
    setCurrentUser,
    setSettings,
    cacheUsersFromBootstrap,
    setUsers
  } = useUserCacheStore();

  const markCacheAsLoaded = useCallback(() => {
    console.log("📋 Marking cached data as loaded (from cache)...");
    
    setHasLoadedConversations(true);
    setHasLoadedUnreadConversationIds(true);
    setHasLoadedPendingRequests(true);
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

  const distributeCriticalData = useCallback(async (data: CriticalBootstrapResponseDTO) => {
    console.log("📦 Distributing critical bootstrap data (no messages yet)...");
  
    // 1. SyncToken til BootstrapStore
    setCriticalData(data);
  
    // 2. KRITISK: Sett current user FØRST i UserCacheStore
    setCurrentUser(data.user);

    // 3. Settings til UserCacheStore (flyttet fra secondary)
    setSettings(data.settings);

    console.log("✅ Critical data distributed:", {
      user: data.user.fullName,
      settings: data.settings.language || 'default',
      syncToken: !!data.syncToken,
      stores: "BootstrapStore (syncToken) + UserCacheStore (currentUser + settings)"
    });
  }, [
    setCriticalData,
    setCurrentUser,
    setSettings
  ]);

  const distributeSecondaryData = useCallback(async (data: SecondaryBootstrapResponseDTO) => {
    console.log("📦 Distributing secondary bootstrap data with E2EE decryption...");
    
    // 1. Bootstrap timestamps til BootstrapStore
    setSecondaryData(data);

    // 2. Conversations til ChatStore
    setConversations(data.recentConversations);
    setHasLoadedConversations(true);

    // 3. DEKRYPTERING: Håndter alle E2EE scenarioer - Simplisert!
    if (data.conversationMessages) {
      await handleConversationMessages(data.conversationMessages);
    }

    // 4. Chat-relatert data direkte til ChatStore
    setUnreadConversationIds(data.unreadConversationIds);
    setHasLoadedUnreadConversationIds(true);
   
    // 5. Pending message requests til ChatStore
    setPendingMessageRequests(data.pendingMessageRequests);
    setHasLoadedPendingRequests(true);
    setCachedPendingRequests(data.pendingMessageRequests);

    // 6. MessageNotifications til MessageNotificationStore
    if (data.recentMessageNotifications && data.recentMessageNotifications.length > 0) {
      const merged = mergeMessageNotifications(data.recentMessageNotifications);
      setMessageNotificationsInStore(merged, "bootstrap");
    } else {
      setHasLoadedMessageNotifications(true);
      console.log("📨 Ingen message notifications mottatt, men marker som loaded");
    }

    // 7. Friend invitations til NotificationStore
    if (data.pendingFriendInvitations && data.pendingFriendInvitations.length > 0) {
      setFriendRequests(data.pendingFriendInvitations);
      setHasLoadedFriendRequests(true);

      const { setFriendRequestTotalCount } = useNotificationStore.getState();
      setFriendRequestTotalCount(data.pendingFriendInvitations.length);
    } else {
      setHasLoadedFriendRequests(true);
    }

    // 8. App notifications til NotificationStore
    if (data.recentNotifications && data.recentNotifications.length > 0) {
      setNotifications(data.recentNotifications);
      setHasLoadedNotifications(true);
    } else {
      setHasLoadedNotifications(true);
    }

    // 9. Cache all users med relationships i UserCache
    if (data.allUserSummaries && data.allUserSummaries.length > 0) {
      setUsers(data.allUserSummaries);
    }

    // 10. Cache all other users from bootstrap data (unified method)
    cacheUsersFromBootstrap(data);  // Only secondary data

    console.log("✅ Secondary data distributed:", {
      conversations: data.recentConversations.length,
      conversationMessages: Object.keys(data.conversationMessages || {}).length,
      totalMessages: Object.values(data.conversationMessages || {}).reduce((sum, msgs) => sum + msgs.length, 0),
      unreadConversations: data.unreadConversationIds.length,
      pendingRequests: data.pendingMessageRequests.length,
      messageNotifications: data.recentMessageNotifications?.length || 0,
      pendingFriendInvitations: data.pendingFriendInvitations.length,
      appNotifications: data.recentNotifications?.length || 0,
      allUserSummaries: data.allUserSummaries?.length || 0,
      stores: "BootstrapStore + ChatStore + MessageNotificationStore + NotificationStore + UserCache",
      encryption: "Messages and attachments decrypted in secondary bootstrap"
    });
  }, [
    setSecondaryData,
    setConversations,
    setHasLoadedConversations,
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
    handleConversationMessages,
    cacheUsersFromBootstrap,
  ]);

  return {
    distributeCriticalData,
    distributeSecondaryData,
    markCacheAsLoaded,
  };
};