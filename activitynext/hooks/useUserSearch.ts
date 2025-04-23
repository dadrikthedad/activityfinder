// Hook for å søke etter brukere i søkefeltet i navbaren, bruker services sin searchUser for API-kallet til backend sin UserController.cs
import { useState, useEffect } from "react";
import { searchUsers } from "@/services/user/searchUsers";
import { UserSummaryDTO } from "@/types/FriendInvitationDTO";

export function useUserSearch() {
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
      const data = await searchUsers(query);
      setResults(data);
      setLoading(false);
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [query]);

  return { query, setQuery, results, loading };
}
