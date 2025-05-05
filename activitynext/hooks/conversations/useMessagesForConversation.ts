// Hooken for å hente meldinger til en samtale. Sender inn samtaleId 
import { useCallback } from "react";
import { usePaginatedFetch } from "@/hooks/common/usePaginatedFetch";
import { getMessagesForConversation } from "@/services/messages/conversationService";
import { MessageDTO } from "@/types/MessageDTO";

export function useMessagesForConversation(conversationId: number | null) {
    const isValidId = typeof conversationId === "number" && conversationId > 0;
  
    const fetchMessages = useCallback(
      async (skip: number, take: number) => {
        if (!isValidId) return [];
        return await getMessagesForConversation(conversationId!, skip, take);
      },
      [conversationId, isValidId] // bare endre når samtale-id endres
    );
  
    const {
      data: messages,
      loading,
      error,
      hasMore,
      loadMore,
      reload,
    } = usePaginatedFetch<MessageDTO>({
      fetchFn: fetchMessages,
      autoLoad: isValidId,
    });
  
    return { messages, loading, error, hasMore, loadMore, reload };
  }