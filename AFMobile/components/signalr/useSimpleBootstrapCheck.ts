import { useCallback } from 'react';
import { useBootstrapStore } from '@/store/useBootstrapStore';
import { useConversationStore } from '@/store/useConversationStore';

export const useSimpleBootstrapCheck = () => {

  const checkAndExecute = useCallback(async (
    handler: () => Promise<void>
  ) => {
    const { isBootstrapped } = useBootstrapStore.getState();
    const { hasLoadedPendingConversations } = useConversationStore.getState();

    // ✅ ENKEL SJEKK: Kun kjør hvis bootstrap har levert pending samtaler
    if (isBootstrapped && hasLoadedPendingConversations) {
      console.log("✅ Bootstrap har levert pending requests, kjører SignalR handler");
      await handler();
    } else {
      console.log("⏳ Bootstrap har ikke levert pending requests ennå, hopper over SignalR event");
      // Bootstrap vil hente den når den kjører
    }
  }, []);

  return { checkAndExecute };
};