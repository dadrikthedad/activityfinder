// features/messages/hooks/useNewMessageSearch.ts
// Debounced brukersøk for NewMessage. Returnerer GUID-baserte resultater.

import { useEffect, useState } from "react";
import { MessagingErrorCode } from "@/core/errors/ErrorCode";
import { UserSearchResultDTO } from "../models/UserSearchResultDTO";
import { searchUsers } from "../services/userSearchService";

export function useNewMessageSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserSearchResultDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorCode, setErrorCode] = useState<MessagingErrorCode | null>(null);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setErrorCode(null);
      setLoading(false);
      return;
    }

    const handle = setTimeout(async () => {
      setLoading(true);
      setErrorCode(null);
      const result = await searchUsers(trimmed);
      if (result.success) {
        setResults(result.data);
      } else {
        setResults([]);
        setErrorCode(result.code);
      }
      setLoading(false);
    }, 300);

    return () => clearTimeout(handle);
  }, [query]);

  return { query, setQuery, results, loading, errorCode };
}
