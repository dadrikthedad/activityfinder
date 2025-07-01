// hooks/useUserSearchForGroupInvite.ts
import { useState, useEffect } from "react";
import { UserSummaryDTO } from "@/types/UserSummaryDTO";
import { searchUsersForGroupInvite } from "@/services/user/searchUsers";

export function useUserSearchForGroupInvite(conversationId: number) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserSummaryDTO[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const delayDebounce = setTimeout(async () => {
      setLoading(true);
      const data = await searchUsersForGroupInvite(query, conversationId);
      setResults(data);
      setLoading(false);
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [query, conversationId]);

  return { query, setQuery, results, loading };
}