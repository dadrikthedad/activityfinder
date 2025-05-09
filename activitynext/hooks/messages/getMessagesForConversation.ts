// Her henter vi meldinger til en samtale fra backend ved å sende inn en samtaleId. Denne sikrer paginering
import { useState, useEffect } from "react";
import { getMessagesForConversation } from "@/services/messages/conversationService";
import { MessageDTO } from "@/types/MessageDTO";

export function usePaginatedMessages(conversationId: number) {
  const take = 20;

  const [messages, setMessages] = useState<MessageDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  // 🔄 Reset når conversationId endres
  useEffect(() => {
    setMessages([]);
    setHasMore(true);
    setLoading(false);
  }, [conversationId]);

  const loadMore = async () => {
    if (loading || !hasMore) return;

    setLoading(true);
    try {
      const skipCount = messages.length;
      const newMessages = await getMessagesForConversation(conversationId, skipCount, take) ?? [];

      if (newMessages.length > 0) {
        const existingIds = new Set(messages.map((m) => m.id));
        const uniqueNew = newMessages.filter((m) => !existingIds.has(m.id));
        setMessages((prev) => [...prev, ...uniqueNew]);

        if (newMessages.length < take) {
          setHasMore(false);
        }
      } else {
        setHasMore(false);
      }
    } finally {
      setLoading(false);
    }
  };

  return { messages, loadMore, loading, hasMore };
}