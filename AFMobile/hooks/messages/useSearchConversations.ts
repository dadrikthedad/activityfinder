import { useState, useEffect } from "react";
import { searchConversations } from "@/services/messages/conversationService";
import { ConversationDTO } from "@shared/types/ConversationDTO";

export function useConversationSearch(debounceDelay: number = 300) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ConversationDTO[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {

    if (!query.trim()) {
      setResults([]);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setLoading(true);
      console.log("⏳ Søker etter samtaler...");
      try {
        const data = await searchConversations(query);
        console.log("✅ Søkeresultat mottatt:", data);
        setResults(data ?? []);
      } catch (error) {
        console.error("❌ Feil under søk:", error);
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, debounceDelay);

    return () => clearTimeout(timeoutId);
  }, [query, debounceDelay]);

  return {
    query,
    setQuery,
    results,
    loading,
  };
}
