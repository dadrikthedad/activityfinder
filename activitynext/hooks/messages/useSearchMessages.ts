import { useState, useCallback } from "react";
import { MessageDTO } from "@/types/MessageDTO";
import { searchMessagesInConversation } from "@/services/messages/messageService";

export function useSearchMessages() {
  const [messages, setMessages] = useState<MessageDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const resetSearch = () => setMessages([]);

  const search = useCallback(async (conversationId: number, query: string, skip: number = 0, take: number = 50) => {
    setLoading(true);
    setError(null);

    try {
      const results = await searchMessagesInConversation(conversationId, query, skip, take);
      if (skip === 0) {
        setMessages(results ?? []);
      } else {
        setMessages(prev => [...prev, ...(results ?? [])]);
      }
    } catch (err) {
      console.error("❌ Feil ved søk i meldinger:", err);
      setError("Klarte ikke å søke i meldinger.");
    } finally {
      setLoading(false);
    }
  }, []);

  return { messages, loading, error, search, resetSearch };
}
