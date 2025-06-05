// Henter meldingsforespørsler
import { useChatStore } from '@/store/useChatStore';

export function usePendingMessageRequests() {
  const requests = useChatStore((s) => s.pendingMessageRequests);
  const loaded = useChatStore((s) => s.hasLoadedPendingRequests);

  return {
    requests,
    loading: !loaded, // ✅ basert på init
    error: null,
  };
}