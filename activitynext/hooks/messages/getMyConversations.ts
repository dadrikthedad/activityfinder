// Her henter vi samtaler med paginering
import { useState, useCallback, useEffect } from "react";
import { getMyConversations } from "@/services/messages/conversationService";
import { useChatStore } from "@/store/useChatStore";

export const take = 20;

export function usePaginatedConversations() {
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const conversations = useChatStore((state) => state.conversations);
  const hasLoaded = useChatStore((s) => s.hasLoadedConversations);

  const loadMore = useCallback(async () => {
    setLoading(true);
    
    // 🎯 SMART SKIP: Start fra conversations.length, men bootstrap har allerede 10
    const currentCount = useChatStore.getState().conversations.length;
    let skip = currentCount;
    
    // 👈 BOOTSTRAP-AWARE: Hvis vi har færre enn 10, kan det være fra bootstrap
    // Start fra 10 for å unngå duplikater med bootstrap-data
    if (currentCount > 0 && currentCount <= 10) {
      skip = 10; // Start etter bootstrap-conversations
      console.log("🚀 Bootstrap detected, starting skip from 10");
    }
    
    console.log("🔄 loadMore() called. Skip:", skip, "Take:", take, "Current count:", currentCount);
    
    try {
      const response = await getMyConversations(skip, take);
      const newConversations = response?.conversations || [];
      
      console.log("📬 load - Got conversations:", newConversations.length);
      
      // Legg til nye conversations (addConversation håndterer duplicates)
      newConversations.forEach(useChatStore.getState().addConversation);
      
      // Justér hasMore basert på resultat
      if (newConversations.length < take) {
        setHasMore(false);
        console.log("🏁 Reached end of conversations");
      }
    } catch (err) {
      console.error("❌ Feil ved henting av samtaler:", err);
      setHasMore(false); // fallback
    } finally {
      setLoading(false);
    }
  }, []);

  // Når init-data er lastet: bestem om det finnes mer
  useEffect(() => {
    if (!hasLoaded) return;
    
    const currentCount = conversations.length;
    console.log("📊 Evaluating hasMore. Count:", currentCount);
    
    // 🎯 BOOTSTRAP-AWARE hasMore logic
    if (currentCount === 0) {
      setHasMore(false); // Ingen conversations i det hele tatt
    } else if (currentCount < 10) {
      setHasMore(false); // Færre enn bootstrap-size, sannsynligvis alt som finnes
    } else if (currentCount === 10) {
      setHasMore(true); // Akkurat bootstrap-size, kan finnes mer
    } else {
      // Mer enn 10, bruk normal remainder-logikk
      const remainder = (currentCount - 10) % take;
      const shouldFetchMore = remainder === 0;
      setHasMore(shouldFetchMore);
    }
    
    console.log("🔮 hasMore set to:", hasMore);
  }, [hasLoaded, conversations.length]);

  return {
    loadMore,
    loading,
    hasMore,
  };
}