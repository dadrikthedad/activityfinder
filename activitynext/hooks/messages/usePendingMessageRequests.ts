// Henter meldingsforespørsler
import { useEffect, useState } from 'react';
import { getPendingMessageRequests } from '@/services/messages/messageService';
import { useChatStore } from '@/store/useChatStore';


export function usePendingMessageRequests() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const requests = useChatStore((state) => state.pendingMessageRequests);
  const setRequests = useChatStore((state) => state.setPendingMessageRequests);

  useEffect(() => {
    if (requests.length > 0) {
      setLoading(false);
      return;
    }

    async function fetchRequests() {
      try {
        const data = await getPendingMessageRequests() ?? [];
        setRequests(data);
      } catch (err) {
        console.error('Feil ved henting av forespørsler:', err);
        setError('Klarte ikke hente meldingsforespørsler');
      } finally {
        setLoading(false);
      }
    }

    fetchRequests();
  }, [requests.length, setRequests]);

  return { requests, loading, error };
}

