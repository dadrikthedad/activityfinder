import { useCallback } from 'react';
import { useBootstrapStore } from '@/store/useBootstrapStore';
import { useChatStore } from '@/store/useChatStore';

export const useSimpleBootstrapCheck = () => {
  
  const checkAndExecute = useCallback(async (
    handler: () => Promise<void>
  ) => {
    const { isBootstrapped } = useBootstrapStore.getState();
    const { hasLoadedPendingRequests } = useChatStore.getState();
    
    // ✅ ENKEL SJEKK: Kun kjør hvis bootstrap har levert pending requests
    if (isBootstrapped && hasLoadedPendingRequests) {
      console.log("✅ Bootstrap har levert pending requests, kjører SignalR handler");
      await handler();
    } else {
      console.log("⏳ Bootstrap har ikke levert pending requests ennå, hopper over SignalR event");
      // Bootstrap vil hente den når den kjører
    }
  }, []);

  return { checkAndExecute };
};