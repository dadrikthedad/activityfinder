// Her henter vi meldinger til en samtale fra backend ved å sende inn en samtaleId. Denne sikrer paginering
import { useState, useEffect } from "react";
import { getMessagesForConversation } from "@/services/messages/conversationService";
import { MessageDTO } from "@/types/MessageDTO";
import { useChatStore } from "@/store/useChatStore";

export function usePaginatedMessages(conversationId: number) {
  const take = 20;

  const { cachedMessages, setCachedMessages } = useChatStore();

  const [messages, setMessages] = useState<MessageDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  // Når vi bytter samtale, prøv å bruk cache
  useEffect(() => {
    const cached = cachedMessages[conversationId];
    if (cached?.length) {
      setMessages(cached);
    } else {
      setMessages([]);
    }
    setHasMore(true);
    setLoading(false);
  }, [conversationId, cachedMessages]);

  const loadMore = async () => {
    if (loading || !hasMore) return;

      setLoading(true);
  try {
    const skipCount = messages.length;
    const newMessages = await getMessagesForConversation(conversationId, skipCount, take) ?? [];

    const existingIds = new Set(messages.map((m) => m.id));
    const uniqueNew = newMessages.filter((m) => !existingIds.has(m.id));

    if (uniqueNew.length > 0) {
      const updated = [...messages, ...uniqueNew];
      setMessages(updated);
      setCachedMessages(conversationId, updated);
    }

    if (newMessages.length < take) {
      setHasMore(false);
    }
  } finally {
    setLoading(false);
  }
};

  return { messages, loadMore, loading, hasMore };
}