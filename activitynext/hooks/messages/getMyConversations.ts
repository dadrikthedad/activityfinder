// Her henter vi samtaler med paginering
import { useState, useCallback, useEffect } from "react";
import { getMyConversations } from "@/services/messages/conversationService";
import { useChatStore } from "@/store/useChatStore";

export function usePaginatedConversations() {
  const take = 20;
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [initialized, setInitialized] = useState(false);

  const conversations = useChatStore((state) => state.conversations);

  const loadMore = useCallback(async () => {
  // Ikke bruk gamle `loading`/`hasMore`-verdier som kan være stale
  setLoading(true);

  const skip = useChatStore.getState().conversations.length;
  console.log("🔄 loadMore() called. Skip:", skip, "Take:", take);

  try {
    const response = await getMyConversations(skip, take);
    const newConversations = response?.conversations || [];

    console.log("📬 load - Got conversations:", newConversations.length);

    if (newConversations.length > 0) {
      newConversations.forEach(useChatStore.getState().addConversation);
      if (newConversations.length < take) {
        setHasMore(false);
      }
    } else {
      if (skip % take === 0) {
        console.warn("⚠️ load Tom respons, men mulig det finnes mer. Ikke sett hasMore = false ennå.");
      }
      setHasMore(false);
    }
  } finally {
    setLoading(false);
  }
}, []);

  // Initielt forsøk på å hente dersom vi ikke har fått noe fra NotificationInitializer
  useEffect(() => {
    if (!initialized) {
      if (conversations.length === 0) {
        console.log("📥 load Ingen samtaler – henter første batch");
        loadMore().then(() => setInitialized(true));
      } else {
        const possiblyMore = conversations.length % take === 0;
        setHasMore(possiblyMore);
        console.log("📦 load Samtaler allerede lastet fra init. Har flere?", possiblyMore);
        setInitialized(true);
      }
    }
  }, [initialized, loadMore, conversations.length]);
return {
  loadMore,
  loading,
  hasMore,
};
}