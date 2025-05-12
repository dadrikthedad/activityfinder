// Henter meldingsforespørsler
import { useEffect, useState } from 'react';
import { getPendingMessageRequests } from '@/services/messages/messageService'; // Juster path om nødvendig
import { MessageRequestDTO } from '@/types/MessageReqeustDTO'; // Importér riktig type

export function usePendingMessageRequests() {
  const [requests, setRequests] = useState<MessageRequestDTO[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchRequests() {
      try {
        const data = await getPendingMessageRequests();
        setRequests(data);
      } catch (err) {
        console.error('Feil ved henting av forespørsler:', err);
        setError('Klarte ikke hente meldingsforespørsler');
      } finally {
        setLoading(false);
      }
    }

    fetchRequests();
  }, []);

  return { requests, loading, error };
}


