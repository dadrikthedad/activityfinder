import { useMessageNotificationStore } from '@/store/useMessageNotificationStore';
import { MessageNotificationDTO } from '@shared/types/MessageNotificationDTO';

/**
 * Hjelpefunksjon for å merge message notifications med eksisterende data
 * Brukes både i bootstrap og i fetchAndSetMessageNotifications
 */
export function mergeMessageNotifications(newNotifications: MessageNotificationDTO[]): MessageNotificationDTO[] {
  const store = useMessageNotificationStore.getState();
  
  // Fjern midlertidige notifikasjoner fra lokal zustand
  const cleaned = store.messageNotifications.filter(n => !n.isTemporary);
  
  // Slå sammen og unngå duplikater på ID
  const combined = [...newNotifications, ...cleaned];
  const uniqueById = new Map<number, MessageNotificationDTO>();
  combined.forEach((n) => uniqueById.set(n.id, n));
  
  return Array.from(uniqueById.values());
}

/**
 * Hjelpefunksjon for å sette message notifications i store
 */
export function setMessageNotificationsInStore(notifications: MessageNotificationDTO[], source: string = "unknown") {
  const store = useMessageNotificationStore.getState();
  
  store.setMessageNotifications(notifications);
  store.setHasLoadedNotifications(true);
  
  console.log(`📨 Lagrer ${notifications.length} unike message notifications i Zustand (via ${source}).`);
}