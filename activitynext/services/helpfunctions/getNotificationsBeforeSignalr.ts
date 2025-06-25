// Sikrer at vi hetner alle notifikasjoner før signalr gjør at ikke alle blir lastet inn

import { getMessageNotifications } from "../messages/messageNotificationService";
import { useMessageNotificationStore } from "@/store/useMessageNotificationStore";
import { MessageNotificationDTO } from "@/types/MessageNotificationDTO";

export async function fetchAndSetMessageNotifications(page = 1, pageSize = 20) {
  const data = await getMessageNotifications(page, pageSize);

  const store = useMessageNotificationStore.getState();

  // Fjern midlertidige notifikasjoner fra lokal zustand
  const cleaned = store.notifications.filter(n => !n.isTemporary);

  // Slå sammen og unngå duplikater på ID
  const combined = [...data.notifications, ...cleaned];
  const uniqueById = new Map<number, MessageNotificationDTO>();
  combined.forEach((n) => uniqueById.set(n.id, n));

  const merged = Array.from(uniqueById.values());

  store.setNotifications(merged);
  store.setHasLoadedNotifications(true);

  console.log(`🔔 Lagrer ${merged.length} unike notifikasjoner i Zustand.`);

  return data.notifications;
}


export async function handleIncomingNotification(
    notification: MessageNotificationDTO,
    options?: { onlyIfNew?: boolean }
  ): Promise<boolean> {
    // 🚫 Ikke håndter reaksjonsnotifikasjoner her – de håndteres i ChatHubClient
    if (notification.type === "MessageReaction") return false;
    
    let store = useMessageNotificationStore.getState();
    
    // 🚨 Må hente på nytt etter fetch
    const hasFetchedNewMessageNotifs = store.notifications.some(
      (n) => n.type === "NewMessage"
    );
    if (!hasFetchedNewMessageNotifs) {
      await fetchAndSetMessageNotifications();
      // 🧠 Viktig! oppdater snapshot etter async
      store = useMessageNotificationStore.getState();
    }
    
    const existing = store.notifications.find(
      (n) =>
        n.conversationId === notification.conversationId &&
        n.type === notification.type &&
        !n.isRead
    );
    
    // Blokker hvis kun nye er tillatt
    if (options?.onlyIfNew && existing) return false;
    
    // 🆕 Håndter GroupEvent notifikasjoner
    if (notification.type === "GroupEvent" && existing) {
      const eventCount = notification.eventCount ?? 1;
      
      // Generer ny messagePreview basert på eventCount
      let newMessagePreview: string;
      if (eventCount > 1) {
        newMessagePreview = `There are ${eventCount} new activities in "${notification.groupName}"`;
      } else {
        newMessagePreview = `New activity in "${notification.groupName}"`;
      }
      
      const updated: MessageNotificationDTO = {
        ...existing,
        eventCount: eventCount, // 🆕 Oppdater eventCount
        messageCount: eventCount, // Sync med eventCount for konsistens
        createdAt: notification.lastUpdatedAt || notification.createdAt, // 🆕 Bruk lastUpdatedAt
        lastUpdatedAt: notification.lastUpdatedAt, // 🆕
        messagePreview: newMessagePreview,
        senderId: notification.senderId, // Oppdater til siste actor
        senderName: notification.senderName, // Oppdater til siste actor
        senderProfileImageUrl: notification.senderProfileImageUrl,
        eventSummaries: notification.eventSummaries, // 🆕 Oppdater event summaries
        isTemporary: existing.isTemporary ?? false,
      };
      
      store.upsertNotification(updated);
      return false;
    }
    
    // Håndter NewMessage notifikasjoner (eksisterende logikk)
    if (notification.type === "NewMessage" && existing) {
      const count = (existing.messageCount ?? 1) + 1;
     
      // Generer ny messagePreview basert på count (som backend gjør)
      let newMessagePreview: string;
      if (existing.groupName) {
        // For grupper: "There are X new messages in GroupName"
        newMessagePreview = `There are ${count} new messages in ${existing.groupName}`;
      } else {
        // For private: "has sent you X messages"
        newMessagePreview = `has sent you ${count} messages`;
      }
      
      const updated: MessageNotificationDTO = {
        ...existing,
        messageCount: count,
        createdAt: notification.createdAt,
        messagePreview: newMessagePreview,
        senderId: notification.senderId,
        senderName: notification.senderName,
        senderProfileImageUrl: notification.senderProfileImageUrl,
        isTemporary: existing.isTemporary ?? false,
      };
     
      store.upsertNotification(updated);
      return false;
    }
    
    // ❌ Fjernet: Håndtering av GroupRequestApproved og GroupRequestInvited
    // Disse håndteres nå av GroupEvent notifikasjoner
    
    // Ny notification – legg til som ny
    store.upsertNotification(notification);
    return true;
}

export async function handleIncomingReactionNotification(
  notification: MessageNotificationDTO,
  options?: { onlyIfNew?: boolean }
): Promise<void> {
  let store = useMessageNotificationStore.getState();
  
  // Sørg for at vi har lastet notifikasjoner
  const hasFetchedReactions = store.notifications.some(n => n.type === "MessageReaction");
  if (!hasFetchedReactions) {
    await fetchAndSetMessageNotifications();
    store = useMessageNotificationStore.getState();
  }

  // Hvis vi bare skal håndtere nye og dette er en oppdatering, ikke gjør noe
  if (options?.onlyIfNew && notification.isReactionUpdate) {
    return;
  }

  // Finn eksisterende notifikasjon
  const existing = store.notifications.find(
    (n) =>
      n.type === "MessageReaction" &&
      n.messageId === notification.messageId &&
      n.senderId === notification.senderId
  );

  if (existing) {
    // Oppdater eksisterende notifikasjon
    const updated: MessageNotificationDTO = {
      ...existing,
      ...notification,
      isRead: existing.isRead, // Behold lokal read-status
      readAt: existing.readAt, // Behold lokal read-timestamp
    };
    store.upsertNotification(updated);
  } else {
    // Ny notifikasjon
    store.upsertNotification(notification);
  }
}