// En hook som kan brukes for å legge til pending-samtale fra signalr
import { syncPendingConversation } from "./syncPendingConversation";

export function usePendingConversationSync() {
  return { syncPendingConversation };
}