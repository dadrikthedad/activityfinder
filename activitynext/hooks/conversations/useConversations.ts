// Hooken for å hente samtaler fra backend
import { usePaginatedFetch } from "@/hooks/common/usePaginatedFetch";
import { getMyConversations } from "@/services/messages/conversationService";
import { ConversationDTO } from "@/types/ConversationDTO";
import { useCallback } from "react";

export function useConversations() {
  const fetchConvos = useCallback(
    async (skip: number, take: number) => {
      const result = await getMyConversations(skip, take);
      return result?.conversations ?? [];
    },
    []
  );

  const {
    data: conversations,
    loading,
    error,
    hasMore,
    loadMore,
    reload, // ✅ denne gir deg en full ny fetch
  } = usePaginatedFetch<ConversationDTO>({
    fetchFn: fetchConvos,
  });

  return {
    conversations,
    loading,
    error,
    hasMore,
    loadMore,
    refetch: reload, // ✅ alias for lesbarhet
  };
}
