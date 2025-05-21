import { useEffect, useState } from "react";
import { getUnreadConversationIds } from "@/services/messages/messageNotificationService";
import { useChatStore } from "@/store/useChatStore";

export function useUnreadConversationIds() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const storeUnreadIds = useChatStore(state => state.unreadConversationIds);
  const setStoreUnreadIds = useChatStore(state => state.setUnreadConversationIds);

 useEffect(() => {
  async function fetchAndStoreUnreadIds() {
    try {
      const ids = await getUnreadConversationIds();
      console.log("🟢 API: Hentet unreadConversationIds", ids); // ✅
      setStoreUnreadIds(ids); // 🔥 må faktisk kalles her
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Ukjent feil"));
    } finally {
      setLoading(false);
    }
  }

  fetchAndStoreUnreadIds();
}, [setStoreUnreadIds]);

  return {
    ids: storeUnreadIds,
    loading,
    error,
    hasUnread: storeUnreadIds.length > 0,
  };
}