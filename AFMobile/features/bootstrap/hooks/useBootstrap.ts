import { useState, useCallback } from "react";
import { getCriticalBootstrap, getSecondaryBootstrap } from "@/features/bootstrap/services/bootstrapService";
import { useBootstrapStore } from "@/store/useBootstrapStore";
import { useUserCacheStore } from "@/store/useUserCacheStore";
import { useConversationStore } from "@/store/useConversationStore";
import { useMessageNotificationStore } from "@/store/useMessageNotificationStore";
import { useBootstrapE2EEHandler } from "@/components/ende-til-ende/useBootstrapE2EEHandler";
import { mergeMessageNotifications, setMessageNotificationsInStore } from "@/utils/messages/MessageNotificationFunctions";

export type BootstrapPhase = "idle" | "critical" | "secondary" | "decrypting" | "done" | "error";

export interface UseBootstrapReturn {
  phase: BootstrapPhase;
  errorMessage: string | null;
  runBootstrap: () => Promise<void>;
}

export const useBootstrap = (): UseBootstrapReturn => {
  const [phase, setPhase] = useState<BootstrapPhase>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const {
    setCriticalLoading,
    setCriticalError,
    markCriticalLoaded,
    setSecondaryLoading,
    setSecondaryError,
    markSecondaryLoaded,
  } = useBootstrapStore();

  const {
    setCurrentUser,
    setProfile,
    setSettings,
    setBlockedUsers,
    cacheUsersFromBootstrap,
  } = useUserCacheStore();

  const {
    setConversations,
    setPendingConversations,
    setUnreadConversationIds,
    setHasLoadedConversations,
    setHasLoadedPendingConversations,
    setHasLoadedUnreadConversationIds,
  } = useConversationStore();

  const { setHasLoadedNotifications } = useMessageNotificationStore();

  const { handleConversationMessages } = useBootstrapE2EEHandler();

  const runBootstrap = useCallback(async () => {
    setPhase("critical");
    setErrorMessage(null);
    setCriticalLoading(true);

    const criticalResult = await getCriticalBootstrap();
    if (!criticalResult.success) {
      setCriticalError(criticalResult.error);
      setErrorMessage(criticalResult.error);
      setPhase("error");
      return;
    }

    const critical = criticalResult.data;
    setCurrentUser(critical.user);
    setProfile(critical.profile);
    setSettings(critical.settings);
    setBlockedUsers(critical.blockedUsers);
    markCriticalLoaded();

    setPhase("secondary");
    setSecondaryLoading(true);

    const secondaryResult = await getSecondaryBootstrap();
    if (!secondaryResult.success) {
      setSecondaryError(secondaryResult.error);
      setErrorMessage(secondaryResult.error);
      setPhase("error");
      return;
    }

    const secondary = secondaryResult.data;

    setConversations(secondary.activeConversations);
    setHasLoadedConversations(true);

    setPendingConversations(secondary.pendingConversations);
    setHasLoadedPendingConversations(true);

    setUnreadConversationIds(secondary.unreadConversationIds);
    setHasLoadedUnreadConversationIds(true);

    if (secondary.messageNotifications?.length) {
      const merged = mergeMessageNotifications(secondary.messageNotifications);
      setMessageNotificationsInStore(merged, "bootstrap");
    } else {
      setHasLoadedNotifications(true);
    }

    cacheUsersFromBootstrap(secondary);
    markSecondaryLoaded();

    setPhase("decrypting");
    if (secondary.conversationMessages) {
      await handleConversationMessages(secondary.conversationMessages);
    }

    setPhase("done");
  }, [
    setCriticalLoading,
    setCriticalError,
    markCriticalLoaded,
    setCurrentUser,
    setProfile,
    setSettings,
    setBlockedUsers,
    setSecondaryLoading,
    setSecondaryError,
    markSecondaryLoaded,
    setConversations,
    setPendingConversations,
    setUnreadConversationIds,
    setHasLoadedConversations,
    setHasLoadedPendingConversations,
    setHasLoadedUnreadConversationIds,
    setHasLoadedNotifications,
    cacheUsersFromBootstrap,
    handleConversationMessages,
  ]);

  return { phase, errorMessage, runBootstrap };
};
