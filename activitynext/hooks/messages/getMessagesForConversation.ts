// Her henter vi meldinger til en samtale fra backend ved å sende inn en samtaleId. Denne sikrer paginering

import { useState, useEffect, useRef } from "react";
import { getMessagesForConversation } from "@/services/messages/conversationService";
import { MessageDTO } from "@/types/MessageDTO";
import { useChatStore } from "@/store/useChatStore";

export function usePaginatedMessages(conversationId: number) {
  const take = 20;

  const { cachedMessages, setCachedMessages } = useChatStore();

  const [messages, setMessages] = useState<MessageDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const isFetching = useRef(false);
  const lastSkipRef = useRef<number>(-1);

  useEffect(() => {
    const cached = cachedMessages[conversationId];
    if (cached?.length) {
      setMessages(cached);
    } else {
      setMessages([]);
    }
    setHasMore(true);
    setLoading(false);
    lastSkipRef.current = -1; // reset last skip when conversation changes
  }, [conversationId, cachedMessages]);

  const loadMore = async () => {
    if (loading || !hasMore || isFetching.current) return;

    const skipCount = messages.length;
    if (skipCount === lastSkipRef.current) return;

    isFetching.current = true;
    setLoading(true);
    try {
      const newMessages = await getMessagesForConversation(conversationId, skipCount, take) ?? [];

      console.log("📦 Hentet meldinger fra backend:", {
        conversationId,
        skipCount,
        take,
        result: newMessages,
      });

      lastSkipRef.current = skipCount;

      const existingIds = new Set(messages.map((m) => m.id));
      const uniqueNew = newMessages.filter((m) => !existingIds.has(m.id));

      if (uniqueNew.length > 0) {
        const updated = [...messages, ...uniqueNew];
        setMessages(updated);
        setCachedMessages(conversationId, updated);
      }

      if (newMessages.length === 0 || newMessages.length < take) {
        setHasMore(false);
      }
    } finally {
      setLoading(false);
      isFetching.current = false;
    }
  };

  return { messages, loadMore, loading, hasMore };
}
