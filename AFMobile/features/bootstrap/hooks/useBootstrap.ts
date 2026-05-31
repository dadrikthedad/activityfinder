import { useState, useCallback } from "react";
import { getCriticalBootstrap, getSecondaryBootstrap } from "@/features/bootstrap/services/bootstrapService";
import { useBootstrapStore } from "@/store/useBootstrapStore";
import { useUserCacheStore } from "@/store/useUserCacheStore";
import { useConversationStore } from "@/store/useConversationStore";
import { useMessageNotificationStore } from "@/store/useMessageNotificationStore";
import { useBootstrapE2EEHandler } from "@/components/ende-til-ende/useBootstrapE2EEHandler";

export type BootstrapPhase = "critical" | "secondary" | "decrypting" | "done" | "error";

export interface UseBootstrapReturn {
  phase: BootstrapPhase;
  errorMessage: string | null;
  runBootstrap: () => Promise<void>;
}

export const useBootstrap = (): UseBootstrapReturn => {
  const [phase, setPhase] = useState<BootstrapPhase>("critical");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const {
    setCriticalLoading,
    setCriticalError,
    markCriticalLoaded,
    setSecondaryLoading,
    setSecondaryError,
    markSecondaryLoaded,
  } = useBootstrapStore();

  const { setCurrentUser, setSettings } = useUserCacheStore();

  const { setConversations, setUnreadConversationIds } = useConversationStore();

  const { setMessageNotifications, setHasLoadedNotifications } = useMessageNotificationStore();

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

    // Typer stemmer nå med @shared/types/bootstrap/ — ingen as any
    setCurrentUser(critical.user);
    setSettings(critical.settings);
    markCriticalLoaded(critical.syncToken);

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

    setConversations(secondary.recentConversations);
    setUnreadConversationIds(secondary.unreadConversationIds ?? []);

    if (secondary.recentMessageNotifications?.length) {
      setMessageNotifications(secondary.recentMessageNotifications);
    }
    setHasLoadedNotifications(true);

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
    setSettings,
    setSecondaryLoading,
    setSecondaryError,
    markSecondaryLoaded,
    setConversations,
    setUnreadConversationIds,
    setMessageNotifications,
    setHasLoadedNotifications,
    handleConversationMessages,
  ]);

  return { phase, errorMessage, runBootstrap };
};
