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

  // Sjekk om vi har en fersk cache
  const now = Date.now();
  const hasFreshCache = cached.length > 0 && now - cacheTs < PENDING_TTL;

  // Kun sett loading=true hvis vi *ikke* har en god cache
  const [loading, setLoading] = useState(() => !hasFreshCache);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Hydrer umiddelbart hvis vi har cache
    if (hasFreshCache) {
      setRequests(cached);
    }

    // Uansett, kjør bakgrunns-fetch én gang på mount
    (async function fetchRequests() {
      try {
        const data = (await getPendingMessageRequests()) ?? [];
        setRequests(data);
        setCached(data);
      } catch (err) {
        console.error('❌ Feil ved henting av forespørsler:', err);
        setError('Klarte ikke hente meldingsforespørsler');
      } finally {
        // skjul spinner (om den var synlig)
        setLoading(false);
      }
    })();
  // Tom dependency-array = bare på første mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { requests, loading, error };
}