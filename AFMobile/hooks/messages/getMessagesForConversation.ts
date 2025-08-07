import { useState, useEffect, useRef } from "react";
import { getMessagesForConversation } from "@/services/messages/conversationService";
import { MessageDTO } from "@shared/types/MessageDTO";
import { useChatStore } from "@/store/useChatStore";
import { useBootstrapStore } from "@/store/useBootstrapStore"; // 🆕

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
  const isReady = isBootstrapped && hasLoadedConversations && isVisible;

  useEffect(() => {
    if (isInvalidConversation || !isReady) {
      return;
    }
   
    console.log(`🚀 Ready to load messages for conversation ${conversationId}`);
    
    setError(null);
    hasLoadedInitialCache.current = false;
   
    const cached = cachedMessages[conversationId] ?? [];
    const live = liveMessages[conversationId] ?? [];
    const combined = [
      ...cached,
      ...live.filter(m => !cached.some(c => c.id === m.id))
    ];
   
    setMessages(combined);
    
    // 🔧 CRITICAL FIX: Ikke overskrive cache med combined data
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
      
      // 🔧 CRITICAL FIX: Base hasMore på cached messages, ikke combined
      setHasMore(cached.length >= take);
    } else {
      setHasMore(true);
    }
    
    setLoading(false);
    lastSkipRef.current = -1;
   
  }, [conversationId, cachedMessages, liveMessages, isInvalidConversation, isReady]);

  const loadMore = async () => {
    if (isInvalidConversation || loading || !hasMore || isFetching.current || error || !isReady) {
      return;
    }
   
    // 🔧 CRITICAL FIX: Base skipCount på cached messages, ikke combined messages
    const cachedCount = cachedMessages[conversationId]?.length ?? 0;
    const skipCount = cachedCount; // Skip basert på antall cached messages
    
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
      const newMessages = await getMessagesForConversation(conversationId, skipCount, take) ?? [];
     
      console.log("📦 Hentet meldinger fra backend:", {
        conversationId,
        skipCount,
        take,
        newMessagesCount: newMessages.length,
        hasMore: newMessages.length >= take
      });
      
      lastSkipRef.current = skipCount;
      
      // 🔧 CRITICAL FIX: Check against cached messages, not local messages state
      const existingCachedIds = new Set((cachedMessages[conversationId] ?? []).map((m) => m.id));
      const uniqueNew = newMessages.filter((m) => !existingCachedIds.has(m.id));
      
      if (uniqueNew.length > 0) {
        // 🔧 CRITICAL FIX: Combine with existing CACHED messages, not local state
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
    isReady,
  };
}