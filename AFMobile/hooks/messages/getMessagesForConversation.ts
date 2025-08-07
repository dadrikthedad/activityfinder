// Her henter vi meldinger til en samtale fra backend ved å sende inn en samtaleId. Denne sikrer paginering
import { useState, useEffect, useRef } from "react";
import { getMessagesForConversation } from "@/services/messages/conversationService";
import { MessageDTO } from "@shared/types/MessageDTO";
import { useChatStore } from "@/store/useChatStore";

export function usePaginatedMessages(conversationId: number, isVisible: boolean) {
  const take = 20;
  
  // Kall hooks uansett
  const {
    cachedMessages,
    liveMessages,
    setCachedMessages,
  } = useChatStore();
  
  const [messages, setMessages] = useState<MessageDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null); // Error state
  const isFetching = useRef(false);
  const lastSkipRef = useRef<number>(-1);
  
  // Så sjekker vi "ugyldig samtale" og returnerer dummydata
  const isInvalidConversation = conversationId === -1;

  useEffect(() => {
    if (isInvalidConversation || !isVisible) return;
    
    // Reset error when conversation changes
    setError(null);
    
    const cached = cachedMessages[conversationId] ?? [];
    const live = liveMessages[conversationId] ?? [];
    const combined = [
      ...cached,
      ...live.filter(m => !cached.some(c => c.id === m.id))
    ];
    
    setMessages(combined);
    setHasMore(true);
    setLoading(false);
    lastSkipRef.current = -1;
   
  }, [conversationId, cachedMessages, liveMessages, isInvalidConversation, isVisible]);

  const loadMore = async () => {
    if (isInvalidConversation || loading || !hasMore || isFetching.current || error) return; // Stop if error
    
    const skipCount = messages.length;
    
    // 👉 Hvis skipCount = 0 og vi allerede har cachedMessages, ikke fetch på nytt
    if (skipCount === 0 && cachedMessages[conversationId]?.length > 0) {
      console.log("🔁 Skipper initial fetch – meldinger finnes allerede i cache.");
      setHasMore(false); // Eller sett `hasMore` til true hvis det kan finnes eldre
      return;
    }

    if (skipCount === lastSkipRef.current) return;

    isFetching.current = true;
    setLoading(true);
    setError(null); // 🆕 Clear previous errors

    try {
      const newMessages = await getMessagesForConversation(conversationId, skipCount, take) ?? [];
      
      console.log("📦 Hentet meldinger fra backend:", {
        conversationId,
        skipCount,
        take,
        result: newMessages,
      });

      lastSkipRef.current = skipCount;
      const existingIds = new Set(messages.map((m) => m.id));
      const uniqueNew = newMessages.filter((m) => !existingIds.has(m.id));

      if (uniqueNew.length > 0) {
        const updated = [...uniqueNew, ...messages];
        setMessages(updated);
        setCachedMessages(conversationId, updated);
      }

      if (newMessages.length === 0 || newMessages.length < take) {
        setHasMore(false);
      }
      
    } catch (err: unknown) {
      console.error(`❌ Kunne ikke hente meldinger for samtale ${conversationId}:`, err);
      
      let errorMessage = "Could not load messages";
      
      if (err instanceof Error) {
        // Sjekk om error message er JSON med message property
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
    error: isInvalidConversation ? null : error, // Return error state
  };
}