import { useChatStore } from "@/store/useChatStore";

export function useUnreadConversationIds() {
  const ids = useChatStore((s) => s.unreadConversationIds);
  const hasLoaded = useChatStore((s) => s.hasLoadedUnreadConversationIds);

  return {
    ids,
    loading: !hasLoaded,
    hasUnread: ids.length > 0,
  };
}