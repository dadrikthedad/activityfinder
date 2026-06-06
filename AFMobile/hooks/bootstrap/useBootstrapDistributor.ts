// hooks/bootstrap/useBootstrapDistributor.ts
import { useCallback } from 'react';
import { CriticalBootstrapResponseDTO } from '@shared/types/bootstrap/CriticalBootstrapResponseDTO';
import { SecondaryBootstrapResponseDTO } from '@shared/types/bootstrap/SecondaryBootstrapResponseDTO';
import { useBootstrapStore } from '@/store/useBootstrapStore';
import { useConversationStore } from '@/store/useConversationStore';
import { useMessageNotificationStore } from '@/store/useMessageNotificationStore';
import { mergeMessageNotifications, setMessageNotificationsInStore } from '@/utils/messages/MessageNotificationFunctions';
import { useUserCacheStore } from '@/store/useUserCacheStore';
import { useBootstrapE2EEHandler } from '@/components/ende-til-ende/useBootstrapE2EEHandler';

export const useBootstrapDistributor = () => {
  const { markCriticalLoaded, markSecondaryLoaded } = useBootstrapStore();
  const { handleConversationMessages } = useBootstrapE2EEHandler();

  const {
    setConversations,
    setHasLoadedConversations,
    setUnreadConversationIds,
    setHasLoadedUnreadConversationIds,
    setPendingConversations,
    setHasLoadedPendingConversations,
  } = useConversationStore();

  const {
    setHasLoadedNotifications: setHasLoadedMessageNotifications,
  } = useMessageNotificationStore();

  const {
    setCurrentUser,
    setProfile,
    setSettings,
    setBlockedUsers,
    cacheUsersFromBootstrap,
  } = useUserCacheStore();

  const markCacheAsLoaded = useCallback(() => {
    console.log("📋 Marking cached data as loaded (from cache)...");

    setHasLoadedConversations(true);
    setHasLoadedUnreadConversationIds(true);
    setHasLoadedPendingConversations(true);
    setHasLoadedMessageNotifications(true);

    console.log("✅ All loading flags set to true (cache mode)");
  }, [
    setHasLoadedConversations,
    setHasLoadedUnreadConversationIds,
    setHasLoadedPendingConversations,
    setHasLoadedMessageNotifications,
  ]);

  const distributeCriticalData = useCallback(async (data: CriticalBootstrapResponseDTO) => {
    console.log("📦 Distributing critical bootstrap data...");

    // 1. Cache-metadata til BootstrapStore (ingen syncToken i critical)
    markCriticalLoaded();

    // 2. Sett innlogget bruker i UserCacheStore
    setCurrentUser(data.user);

    // 3. Profil, settings og blokkerte brukere
    setProfile(data.profile);
    setSettings(data.settings);
    setBlockedUsers(data.blockedUsers);

    console.log("✅ Critical data distributed:", {
      user: data.user.fullName,
      language: data.settings.language,
      blockedUsers: data.blockedUsers.length,
    });
  }, [
    markCriticalLoaded,
    setCurrentUser,
    setProfile,
    setSettings,
    setBlockedUsers,
  ]);

  const distributeSecondaryData = useCallback(async (data: SecondaryBootstrapResponseDTO) => {
    console.log("📦 Distributing secondary bootstrap data with E2EE decryption...");

    // 1. Bootstrap timestamps til BootstrapStore
    markSecondaryLoaded();

    // 2. Aktive samtaler til ConversationStore
    setConversations(data.activeConversations);
    setHasLoadedConversations(true);

    // 3. Ventende samtaler til ConversationStore
    setPendingConversations(data.pendingConversations);
    setHasLoadedPendingConversations(true);

    // 4. DEKRYPTERING: Håndter alle E2EE scenarioer
    if (data.conversationMessages) {
      await handleConversationMessages(data.conversationMessages);
    }

    // 5. Uleste samtaler
    setUnreadConversationIds(data.unreadConversationIds);
    setHasLoadedUnreadConversationIds(true);

    // 6. MessageNotifications til MessageNotificationStore
    if (data.messageNotifications && data.messageNotifications.length > 0) {
      const merged = mergeMessageNotifications(data.messageNotifications);
      setMessageNotificationsInStore(merged, "bootstrap");
    } else {
      setHasLoadedMessageNotifications(true);
      console.log("📨 Ingen message notifications mottatt");
    }

    // 7. Cache deltakere fra samtaler i UserCacheStore
    cacheUsersFromBootstrap(data);

    console.log("✅ Secondary data distributed:", {
      activeConversations: data.activeConversations.length,
      pendingConversations: data.pendingConversations.length,
      conversationMessages: Object.keys(data.conversationMessages || {}).length,
      unreadConversations: data.unreadConversationIds.length,
      messageNotifications: data.messageNotifications?.length || 0,
    });
  }, [
    markSecondaryLoaded,
    setConversations,
    setHasLoadedConversations,
    setPendingConversations,
    setHasLoadedPendingConversations,
    setUnreadConversationIds,
    setHasLoadedUnreadConversationIds,
    setHasLoadedMessageNotifications,
    handleConversationMessages,
    cacheUsersFromBootstrap,
  ]);

  return {
    distributeCriticalData,
    distributeSecondaryData,
    markCacheAsLoaded,
  };
};
