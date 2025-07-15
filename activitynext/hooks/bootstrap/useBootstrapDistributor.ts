import { useCallback } from 'react';
import { CriticalBootstrapResponseDTO } from '@/types/bootstrap/CriticalBootstrapResponseDTO';
import { SecondaryBootstrapResponseDTO } from '@/types/bootstrap/SecondaryBootstrapResponseDTO';
import { useBootstrapStore } from '@/store/useBootstrapStore';
import { useChatStore } from '@/store/useChatStore';

export const useBootstrapDistributor = () => {
  const { setCriticalData, setSecondaryData } = useBootstrapStore();
  
  const { 
    setConversations, 
    setHasLoadedConversations,
    setUnreadConversationIds,
    setHasLoadedUnreadConversationIds,
    setPendingMessageRequests, // 🆕 LEGG TIL
    setHasLoadedPendingRequests, // 🆕 LEGG TIL
    setCachedPendingRequests, // 🆕 LEGG TIL (hvis ChatStore har denne)
  } = useChatStore();

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
    
    // 🆕 3. Pending message requests til ChatStore
    setPendingMessageRequests(data.pendingMessageRequests);
    setHasLoadedPendingRequests(true);
    setCachedPendingRequests(data.pendingMessageRequests); // Cache for later use
    
    console.log("✅ Secondary data distributed:", {
      friends: data.friends.length,
      settings: data.settings.language,
      unreadConversations: data.unreadConversationIds.length,
      pendingRequests: data.pendingMessageRequests.length, // 🆕
      stores: "BootstrapStore + ChatStore"
    });
  }, [
    setSecondaryData, 
    setUnreadConversationIds, 
    setHasLoadedUnreadConversationIds,
    setPendingMessageRequests, // 🆕
    setHasLoadedPendingRequests, // 🆕
    setCachedPendingRequests // 🆕
  ]);

  return {
    distributeCriticalData,
    distributeSecondaryData,
  };
};
