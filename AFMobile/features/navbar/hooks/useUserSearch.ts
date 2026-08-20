import { useState, useEffect } from "react";
import { searchUsers } from "@/features/navbar/services/searchUsersService";
import { UserSummaryDTO } from "@shared/types/UserSummaryDTO";
import { SearchErrorCode } from "@/core/errors/ErrorCode";

export function useUserSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserSummaryDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<SearchErrorCode | null>(null);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setError(null);
      return;
    }

    if (query.trim().length < 2) {
      setResults([]);
      setError(null);
      setLoading(false);
      return;
    }

    const delayDebounce = setTimeout(async () => {
      setLoading(true);
      setError(null);
      const result = await searchUsers(query);
      console.log("🔍 useUserSearch result:", result.success, result.success ? result.data.length : result.error);
      if (result.success) {
        setResults(result.data);
      } else {
        setResults([]);
        setError(result.code);
      }
      setLoading(false);
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [query]);

  return { query, setQuery, results, loading, error };
}
