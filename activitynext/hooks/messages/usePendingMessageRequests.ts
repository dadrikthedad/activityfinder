// hooks/usePendingMessageRequests.ts
import { useState, useCallback} from 'react';
import { MessageRequestDTO } from '@shared/types/MessageReqeustDTO';
import { getPendingMessageRequests } from '@/services/messages/messageService';
import { useChatStore } from '@/store/useChatStore';

interface PaginationState {
  currentPage: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  hasMore: boolean;
  isLoading: boolean;
  error: string | null;
}

export const usePendingMessageRequests = () => {
  // ✅ HOOK HÅNDTERER PAGINATION STATE
  const [pagination, setPagination] = useState<PaginationState>({
    currentPage: 1,
    pageSize: 10,
    totalCount: 0,
    totalPages: 0,
    hasMore: false,
    isLoading: false,
    error: null,
  });

  // ✅ CHATSTORE KUN FOR BASIC REQUESTS DATA
  const { 
    pendingMessageRequests,
    setPendingMessageRequests,
    hasLoadedPendingRequests,
    setHasLoadedPendingRequests,
    removePendingRequest,
    addPendingRequest,
  } = useChatStore();

  // ✅ LOAD FIRST PAGE (for initialization)
  const loadFirstPage = useCallback(async () => {
    if (hasLoadedPendingRequests && pendingMessageRequests.length > 0) {
      console.log("✅ Pending requests already loaded from bootstrap");
      return;
    }

    setPagination(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const result = await getPendingMessageRequests(1, 10);
      
      if (result) {
        setPendingMessageRequests(result.requests);
        setHasLoadedPendingRequests(true);
        
        setPagination({
          currentPage: result.page,
          pageSize: result.pageSize,
          totalCount: result.totalCount,
          totalPages: result.totalPages,
          hasMore: result.hasMore,
          isLoading: false,
          error: null,
        });
        
        console.log("✅ Loaded first page of pending requests:", result.requests.length);
      }
    } catch (error) {
      console.error('❌ Error loading first page of pending requests:', error);
      setPagination(prev => ({ 
        ...prev, 
        isLoading: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }));
    }
  }, [hasLoadedPendingRequests, pendingMessageRequests.length, setPendingMessageRequests, setHasLoadedPendingRequests]);

  // ✅ LOAD MORE PAGES
  const loadMore = useCallback(async () => {
    if (pagination.isLoading || !pagination.hasMore) {
      return;
    }

    setPagination(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const nextPage = pagination.currentPage + 1;
      const result = await getPendingMessageRequests(nextPage, pagination.pageSize);
      
      if (result && result.requests.length > 0) {
        // ✅ APPEND NEW REQUESTS TO EXISTING
        const combined = [...pendingMessageRequests, ...result.requests];
        const sorted = combined.sort(
          (a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime()
        );
        
        setPendingMessageRequests(sorted);
        
        setPagination({
          currentPage: result.page,
          pageSize: result.pageSize,
          totalCount: result.totalCount,
          totalPages: result.totalPages,
          hasMore: result.hasMore,
          isLoading: false,
          error: null,
        });
        
        console.log(`✅ Loaded page ${result.page} of pending requests:`, result.requests.length);
      } else {
        // No more data
        setPagination(prev => ({ 
          ...prev, 
          hasMore: false, 
          isLoading: false 
        }));
      }
    } catch (error) {
      console.error('❌ Error loading more pending requests:', error);
      setPagination(prev => ({ 
        ...prev, 
        isLoading: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }));
    }
  }, [pagination.isLoading, pagination.hasMore, pagination.currentPage, pagination.pageSize, pendingMessageRequests, setPendingMessageRequests]);

  // ✅ REFRESH (reload first page)
  const refresh = useCallback(async () => {
    setPagination(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const result = await getPendingMessageRequests(1, pagination.pageSize);
      
      if (result) {
        setPendingMessageRequests(result.requests);
        
        setPagination({
          currentPage: result.page,
          pageSize: result.pageSize,
          totalCount: result.totalCount,
          totalPages: result.totalPages,
          hasMore: result.hasMore,
          isLoading: false,
          error: null,
        });
        
        console.log("🔄 Refreshed pending requests:", result.requests.length);
      }
    } catch (error) {
      console.error('❌ Error refreshing pending requests:', error);
      setPagination(prev => ({ 
        ...prev, 
        isLoading: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }));
    }
  }, [pagination.pageSize, setPendingMessageRequests]);

  // ✅ REMOVE REQUEST (with pagination update)
  const removeRequest = useCallback((conversationId: number) => {
    removePendingRequest(conversationId);
    setPagination(prev => ({ 
      ...prev, 
      totalCount: Math.max(0, prev.totalCount - 1) 
    }));
  }, [removePendingRequest]);

  // ✅ ADD REQUEST (with pagination update)
  const addRequest = useCallback((request: MessageRequestDTO) => {
    addPendingRequest(request);
    setPagination(prev => ({ 
      ...prev, 
      totalCount: prev.totalCount + 1 
    }));
  }, [addPendingRequest]);

  // ✅ RESET
  const reset = useCallback(() => {
    setPendingMessageRequests([]);
    setHasLoadedPendingRequests(false);
    setPagination({
      currentPage: 1,
      pageSize: 10,
      totalCount: 0,
      totalPages: 0,
      hasMore: false,
      isLoading: false,
      error: null,
    });
  }, [setPendingMessageRequests, setHasLoadedPendingRequests]);

  return {
    // ✅ DATA
    requests: pendingMessageRequests,
    
    // ✅ PAGINATION STATE
    pagination,
    
    // ✅ ACTIONS
    loadFirstPage,
    loadMore,
    refresh,
    removeRequest,
    addRequest,
    reset,
    
    // ✅ CONVENIENCE PROPERTIES
    hasMore: pagination.hasMore,
    isLoading: pagination.isLoading,
    totalCount: pagination.totalCount,
    currentPage: pagination.currentPage,
    error: pagination.error,
    
    // ✅ COMPUTED PROPERTIES
    isEmpty: pendingMessageRequests.length === 0 && !pagination.isLoading,
    hasError: !!pagination.error,
  };
};