// Her henter vi samtaler med paginering
import { useState, useCallback, useEffect, useRef } from "react";
import { getMyConversations } from "@/services/messages/conversationService";
import { useConversationStore } from "@/store/useConversationStore";

export const take = 20;

export function usePaginatedConversations() {
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const conversations = useConversationStore((state) => state.conversations);
  const hasLoaded = useConversationStore((s) => s.hasLoadedConversations);
  const hasFetchedInitial = useRef(false);

  // Initiell henting ved mount: synk listen mot backend (GET /api/conversation/active) slik at en
  // stale/tom persistert store selvhelbreder. Bootstrap kjorer ikke alltid pa nytt ved reload, og
  // addConversation dedup-er — sa dette legger kun til samtaler som mangler lokalt.
  useEffect(() => {
    if (hasFetchedInitial.current) return;
    hasFetchedInitial.current = true;

    (async () => {
      try {
        const response = await getMyConversations(0, take);
        const fetched = response?.conversations ?? [];
        const addConversation = useConversationStore.getState().addConversation;
        fetched.forEach(addConversation);
      } catch (err) {
        console.error("❌ Initiell henting av samtaler feilet:", err);
      }
    })();
  }, []);

  const loadMore = useCallback(async () => {
    setLoading(true);

    // 🎯 SMART SKIP: Start fra conversations.length, men bootstrap har allerede 10
    const currentCount = useConversationStore.getState().conversations.length;
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
      
      // Legg til nye conversations (addConversation håndterer duplicates)
      newConversations.forEach(useConversationStore.getState().addConversation);
      
      // Justér hasMore basert på resultat
      if (newConversations.length < take) {
        setHasMore(false);
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