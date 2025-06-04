// Henter meldingsforespørsler
import { useEffect, useState } from 'react';
import { getPendingMessageRequests } from '@/services/messages/messageService';
import { useChatStore } from '@/store/useChatStore';

const PENDING_TTL = 1000 * 60 * 10; // 10 minutter

export function usePendingMessageRequests() {
  const requests = useChatStore((s) => s.pendingMessageRequests);
  const setRequests = useChatStore((s) => s.setPendingMessageRequests);
  const cached = useChatStore((s) => s.pendingRequestsCache);
  const cacheTs = useChatStore((s) => s.pendingRequestsCacheTimestamp);
  const setCached = useChatStore((s) => s.setCachedPendingRequests);
  const [hasFetched, setHasFetched] = useState(false);

  const now = Date.now();
  const hasFreshCache = cached.length > 0 && now - cacheTs < PENDING_TTL;
  const [loading, setLoading] = useState(!hasFreshCache);


      useEffect(() => {
      // Hvis vi allerede har hentet, ikke gjør det igjen
      if (hasFetched) return;

      if (hasFreshCache) {
        setRequests(cached);
        setHasFetched(true);
        return;
      }

    (async () => {
      try {
        const data = (await getPendingMessageRequests()) ?? [];
        setRequests(data);   // ✅ Bruk for sortering
        setCached(data);
      } catch (err) {
        console.error("❌ Feil ved henting av meldingsforespørsler:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, [hasFreshCache, cached, setRequests, setCached, hasFetched]);

  return {
    requests,
    loading,
    error: null,
  };
}