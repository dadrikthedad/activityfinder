import { useState, useEffect, useRef } from "react";
import { getMessagesForConversation } from "@/services/messages/conversationService";
import { MessageDTO } from "@shared/types/MessageDTO";
import { useChatStore } from "@/store/useChatStore";
import { useBootstrapStore } from "@/store/useBootstrapStore";

export function usePaginatedMessages(conversationId: number, isVisible: boolean) {
  const take = 20;
 
  const {
    cachedMessages,
    liveMessages,
    setCachedMessages,
  } = useChatStore();

  const isBootstrapped = useBootstrapStore(state => state.isBootstrapped);
  const hasLoadedConversations = useChatStore(state => state.hasLoadedConversations);
 
  const [messages, setMessages] = useState<MessageDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isFetching = useRef(false);
  const lastSkipRef = useRef<number>(-1);
  const hasLoadedInitialCache = useRef(false);
 
  const isInvalidConversation = conversationId === -1;
  
  // 🔧 FIX: Separer ready conditions for cache vs API calls
  const canUseCache = isBootstrapped && hasLoadedConversations;
  const canMakeApiCalls = isBootstrapped && isVisible; // Ikke krev hasLoadedConversations for API calls
  
  console.log(`🔍 usePaginatedMessages state for conversation ${conversationId}:`, {
    isBootstrapped,
    hasLoadedConversations,
    isVisible,
    canUseCache,
    canMakeApiCalls,
    isInvalidConversation
  });

  useEffect(() => {
    if (isInvalidConversation) {
      return;
    }
    
    // 🔧 FIX: Reset state når vi bytter samtale
    setError(null);
    hasLoadedInitialCache.current = false;
    lastSkipRef.current = -1;
   
    // Hvis vi kan bruke cache, last cached + live messages
    if (canUseCache) {
      const cached = cachedMessages[conversationId] ?? [];
      const live = liveMessages[conversationId] ?? [];
      const combined = [
        ...cached,
        ...live.filter(m => !cached.some(c => c.id === m.id))
      ];
     
      setMessages(combined);
      
      // Kun oppdater cache hvis live messages inneholder nye data som bør persistent lagres
      const newLiveMessages = live.filter(m => !m.isOptimistic && !cached.some(c => c.id === m.id));
      if (newLiveMessages.length > 0) {
        const updatedCache = [...cached, ...newLiveMessages];
        console.log(`🔄 Adding ${newLiveMessages.length} new live messages to cache (total: ${updatedCache.length})`);
        setCachedMessages(conversationId, updatedCache);
      }
      
      if (cached.length > 0) {
        console.log(`📦 Loaded ${combined.length} messages from cache for conversation ${conversationId} (${cached.length} cached + ${live.length} live)`);
        hasLoadedInitialCache.current = true;
        setHasMore(cached.length >= take);
      } else {
        console.log(`📭 No cached messages for conversation ${conversationId}, will fetch from API`);
        setHasMore(true);
      }
      
      setLoading(false);
    } else {
      // 🆕 NEW: Hvis vi ikke kan bruke cache enda, clear messages og vent
      console.log(`⏳ Waiting for bootstrap/conversations to load for conversation ${conversationId}`);
      setMessages([]);
      setHasMore(true);
      setLoading(false);
    }
   
  }, [conversationId, cachedMessages, liveMessages, isInvalidConversation, canUseCache]);

  // 🆕 NEW: Automatisk initial load når vi blir ready til å gjøre API kall
  useEffect(() => {
    if (isInvalidConversation || !canMakeApiCalls) {
      return;
    }

    const cached = cachedMessages[conversationId] ?? [];
    const hasAnyMessages = messages.length > 0;
    
    // Hvis vi ikke har noen meldinger og heller ikke har cached data, start initial load
    if (!hasAnyMessages && cached.length === 0 && !loading && !isFetching.current) {
      console.log(`🚀 Auto-triggering initial load for conversation ${conversationId} (no cache available)`);
      loadMore();
    }
  }, [conversationId, canMakeApiCalls, messages.length, cachedMessages, loading]);

  const loadMore = async () => {
    // 🔧 FIX: Bruk canMakeApiCalls istedenfor isReady
    if (isInvalidConversation || loading || !hasMore || isFetching.current || error || !canMakeApiCalls) {
      console.log(`🚫 LoadMore blocked:`, {
        isInvalidConversation,
        loading,
        hasMore,
        isFetching: isFetching.current,
        error: !!error,
        canMakeApiCalls
      });
      return;
    }
   
    // Base skipCount på cached messages, ikke combined messages
    const cachedCount = cachedMessages[conversationId]?.length ?? 0;
    const skipCount = cachedCount;
    
    console.log(`📊 LoadMore stats:`, {
      conversationId,
      totalMessages: messages.length,
      cachedCount,
      skipCount,
      hasLoadedInitialCache: hasLoadedInitialCache.current
    });
    
    if (skipCount === 0 && cachedCount === 0) {
      console.log("📡 Initial fetch for conversation", conversationId);
    } else if (skipCount > 0) {
      console.log(`📡 Loading more messages for conversation ${conversationId}, skip: ${skipCount}`);
    }
    
    if (skipCount === lastSkipRef.current) {
      console.log(`🔁 Skip count ${skipCount} already processed, returning`);
      return;
    }
    
    isFetching.current = true;
    setLoading(true);
    setError(null);
    
    try {
      console.log(`🌐 Making API call: getMessagesForConversation(${conversationId}, ${skipCount}, ${take})`);
      const newMessages = await getMessagesForConversation(conversationId, skipCount, take) ?? [];
     
      console.log("📦 Hentet meldinger fra backend:", {
        conversationId,
        skipCount,
        take,
        newMessagesCount: newMessages.length,
        hasMore: newMessages.length >= take
      });
      
      lastSkipRef.current = skipCount;
      
      // Check against cached messages, not local messages state
      const existingCachedIds = new Set((cachedMessages[conversationId] ?? []).map((m) => m.id));
      const uniqueNew = newMessages.filter((m) => !existingCachedIds.has(m.id));
      
      if (uniqueNew.length > 0) {
        // Combine with existing CACHED messages, not local state
        const existingCached = cachedMessages[conversationId] ?? [];
        const updatedCached = [...uniqueNew, ...existingCached]; // Nye først (eldre meldinger)
        
        // Oppdater cache med kombinerte data
        setCachedMessages(conversationId, updatedCached);
        
        // Oppdater local state med nye + eksisterende local messages
        const updatedLocal = [...uniqueNew, ...messages];
        setMessages(updatedLocal);
        
        console.log(`💾 Added ${uniqueNew.length} new messages to cache (total cached: ${updatedCached.length}, local: ${updatedLocal.length})`);
      } else {
        console.log(`🔄 No new unique messages found (got ${newMessages.length} messages)`);
      }
      
      if (newMessages.length < take) {
        console.log(`🏁 No more messages available (got ${newMessages.length}/${take})`);
        setHasMore(false);
      } else {
        console.log(`➡️ More messages may be available (got ${newMessages.length}/${take})`);
        setHasMore(true);
      }
     
    } catch (err: unknown) {
      console.error(`❌ Kunne ikke hente meldinger for samtale ${conversationId}:`, err);
     
      let errorMessage = "Could not load messages";
     
      if (err instanceof Error) {
        if (err.message.includes('"message"')) {
          try {
            const parsed = JSON.parse(err.message);
            errorMessage = parsed.message;
          } catch {
            errorMessage = err.message;
          }
        } else {
          errorMessage = err.message;
        }
      }
     
      setError(errorMessage);
      setHasMore(false);
    } finally {
      setLoading(false);
      isFetching.current = false;
    }
  };

  return {
    messages: isInvalidConversation ? [] : messages,
    loadMore,
    loading: isInvalidConversation ? false : loading,
    hasMore: isInvalidConversation ? false : hasMore,
    error: isInvalidConversation ? null : error,
    isReady: canMakeApiCalls, // 🔧 FIX: Return canMakeApiCalls as isReady
  };
}