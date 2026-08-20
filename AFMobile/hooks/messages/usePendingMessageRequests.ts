// hooks/messages/usePendingMessageRequests.ts
import { useState, useCallback } from 'react';
import { ConversationDTO } from '@shared/types/ConversationDTO';
import { getPendingConversations } from '@/services/messages/conversationService';
import { useConversationStore } from '@/store/useConversationStore';

interface PaginationState {
  currentPage: number;
  pageSize: number;
  totalCount: number;
  hasMore: boolean;
  isLoading: boolean;
  error: string | null;
}

// Pending (uavklarte) samtaler. Data ligger i useConversationStore.pendingConversations
// (fylt av bootstrap); denne hooken håndterer paginert lasting/refresh fra backend
// (GET /api/conversation/pending → ConversationsResponse med totalCount + conversations).
export const usePendingMessageRequests = () => {
  const [pagination, setPagination] = useState<PaginationState>({
    currentPage: 1,
    pageSize: 10,
    totalCount: 0,
    hasMore: false,
    isLoading: false,
    error: null,
  });

  const {
    pendingConversations,
    setPendingConversations,
    hasLoadedPendingConversations,
    setHasLoadedPendingConversations,
    removePendingConversation,
    addPendingConversation,
  } = useConversationStore();

  const setError = (error: unknown) =>
    setPagination(prev => ({
      ...prev,
      isLoading: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }));

  // Last første side (kun hvis ikke allerede lastet via bootstrap)
  const loadFirstPage = useCallback(async () => {
    if (hasLoadedPendingConversations && pendingConversations.length > 0) {
      console.log("✅ Pending conversations already loaded from bootstrap");
      return;
    }

    setPagination(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const result = await getPendingConversations(1, pagination.pageSize);
      if (result) {
        setPendingConversations(result.conversations);
        setHasLoadedPendingConversations(true);
        setPagination(prev => ({
          ...prev,
          currentPage: 1,
          totalCount: result.totalCount,
          hasMore: result.conversations.length < result.totalCount,
          isLoading: false,
          error: null,
        }));
      }
    } catch (error) {
      console.error('❌ Error loading first page of pending conversations:', error);
      setError(error);
    }
  }, [hasLoadedPendingConversations, pendingConversations.length, pagination.pageSize, setPendingConversations, setHasLoadedPendingConversations]);

  // Last flere sider
  const loadMore = useCallback(async () => {
    if (pagination.isLoading || !pagination.hasMore) return;

    setPagination(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const nextPage = pagination.currentPage + 1;
      const result = await getPendingConversations(nextPage, pagination.pageSize);

      if (result && result.conversations.length > 0) {
        // Slå sammen og dedupliser på id
        const byId = new Map<number, ConversationDTO>();
        [...pendingConversations, ...result.conversations].forEach(c => byId.set(c.id, c));
        const combined = Array.from(byId.values());

        setPendingConversations(combined);
        setPagination(prev => ({
          ...prev,
          currentPage: nextPage,
          totalCount: result.totalCount,
          hasMore: combined.length < result.totalCount,
          isLoading: false,
          error: null,
        }));
      } else {
        setPagination(prev => ({ ...prev, hasMore: false, isLoading: false }));
      }
    } catch (error) {
      console.error('❌ Error loading more pending conversations:', error);
      setError(error);
    }
  }, [pagination.isLoading, pagination.hasMore, pagination.currentPage, pagination.pageSize, pendingConversations, setPendingConversations]);

  // Refresh (last side 1 på nytt)
  const refresh = useCallback(async () => {
    setPagination(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const result = await getPendingConversations(1, pagination.pageSize);
      if (result) {
        setPendingConversations(result.conversations);
        setPagination(prev => ({
          ...prev,
          currentPage: 1,
          totalCount: result.totalCount,
          hasMore: result.conversations.length < result.totalCount,
          isLoading: false,
          error: null,
        }));
      }
    } catch (error) {
      console.error('❌ Error refreshing pending conversations:', error);
      setError(error);
    }
  }, [pagination.pageSize, setPendingConversations]);

  const removeRequest = useCallback((conversationId: number) => {
    removePendingConversation(conversationId);
    setPagination(prev => ({ ...prev, totalCount: Math.max(0, prev.totalCount - 1) }));
  }, [removePendingConversation]);

  const addRequest = useCallback((conversation: ConversationDTO) => {
    addPendingConversation(conversation);
    setPagination(prev => ({ ...prev, totalCount: prev.totalCount + 1 }));
  }, [addPendingConversation]);

  const reset = useCallback(() => {
    setPendingConversations([]);
    setHasLoadedPendingConversations(false);
    setPagination({
      currentPage: 1,
      pageSize: 10,
      totalCount: 0,
      hasMore: false,
      isLoading: false,
      error: null,
    });
  }, [setPendingConversations, setHasLoadedPendingConversations]);

  return {
    requests: pendingConversations,
    pagination,
    loadFirstPage,
    loadMore,
    refresh,
    removeRequest,
    addRequest,
    reset,
    hasMore: pagination.hasMore,
    isLoading: pagination.isLoading,
    totalCount: pagination.totalCount,
    currentPage: pagination.currentPage,
    error: pagination.error,
    isEmpty: pendingConversations.length === 0 && !pagination.isLoading,
    hasError: !!pagination.error,
  };
};
