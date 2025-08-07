import { useState, useCallback } from "react";
import { searchMessagesInConversation } from "@/services/messages/messageService";
import { useChatStore } from "@/store/useChatStore";

export function useSearchMessages() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setSearchResults = useChatStore((s) => s.setSearchResults);
  const resetSearch = () => setSearchResults([]);

  const search = useCallback(
    async (conversationId: number, query: string, skip: number = 0, take: number = 50) => {
      setLoading(true);
      setError(null);

      try {
        const results = await searchMessagesInConversation(conversationId, query, skip, take);
        setSearchResults(results ?? []);
      } catch (err) {
        console.error("❌ Feil ved søk i meldinger:", err);
        setError("Klarte ikke å søke i meldinger.");
      } finally {
        setLoading(false);
      }
    },
    [setSearchResults]
  );

  return { loading, error, search, resetSearch };
}