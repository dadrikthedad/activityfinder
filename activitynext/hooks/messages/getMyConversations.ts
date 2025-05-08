// Her henter vi samtaler med paginering
import { useState, useCallback, useEffect } from "react";
import { getMyConversations } from "@/services/messages/conversationService";
import { ConversationDTO } from "@/types/ConversationDTO";

export function usePaginatedConversations() {
    const take = 20;
    const [conversations, setConversations] = useState<ConversationDTO[]>([]);
    const [loading, setLoading] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [initialized, setInitialized] = useState(false);
  
    const loadMore = useCallback(async () => {
      if (loading || !hasMore) return;
  
      setLoading(true);
      try {
        const skip = conversations.length;
        const response = await getMyConversations(skip, take);
        const newConversations = response?.conversations || [];
  
        if (newConversations.length > 0) {
          setConversations((prev) => {
            const existingIds = new Set(prev.map((c) => c.id));
            const uniqueNew = newConversations.filter((c) => !existingIds.has(c.id));
            return [...prev, ...uniqueNew];
          });
  
          if (newConversations.length < take) {
            setHasMore(false);
          }
        } else {
          setHasMore(false);
        }
      } finally {
        setLoading(false);
      }
    }, [loading, hasMore, conversations]);
  
    useEffect(() => {
      setConversations([]);
      setHasMore(true);
      setInitialized(false);
    }, []);
  
    useEffect(() => {
      if (!initialized) {
        loadMore().then(() => setInitialized(true));
      }
    }, [initialized, loadMore]);
  
    return { conversations, loadMore, loading, hasMore };
}