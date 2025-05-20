import { useEffect, useState } from "react";
import { fetchWithAuth } from "@/utils/api/fetchWithAuth";

export function useUnreadConversationIds() {
  const [ids, setIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchIds() {
      try {
        const data = await fetchWithAuth<number[]>("/api/MessageNotifications/unread-conversations");
        setIds(data ?? []);
      } finally {
        setLoading(false);
      }
    }

    fetchIds();
  }, []);

  return { ids, loading };
}
