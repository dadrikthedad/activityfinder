import { useConversationStore } from "@/store/useConversationStore";

export function useUnreadConversationIds() {
  const ids = useConversationStore((s) => s.unreadConversationIds);
  const hasLoaded = useConversationStore((s) => s.hasLoadedUnreadConversationIds);

  return {
    ids,
    loading: !hasLoaded,
    hasUnread: ids.length > 0,
  };
}