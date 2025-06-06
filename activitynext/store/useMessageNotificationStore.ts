import { create } from "zustand";
import { MessageNotificationDTO, NotificationType } from "@/types/MessageNotificationDTO";
import { showNotificationToast } from "@/components/toast/Toast";
import { markMessageNotificationAsRead } from "@/services/messages/messageNotificationService";

type MessageNotificationStore = {
  notifications: MessageNotificationDTO[];
  setNotifications: (notifications: MessageNotificationDTO[]) => void;
  addNotificationFromApi: (notifications: MessageNotificationDTO[]) => void;
  upsertNotification: (incoming: MessageNotificationDTO) => boolean;
  upsertReactionNotification: (
    incoming: MessageNotificationDTO,
    currentUserId: number | null
  ) => boolean;
  markAsRead: (id: number) => Promise<void>;
  markAllAsRead: () => void;
  markAsReadForConversation: (conversationId: number) => void;
  hasLoadedNotifications: boolean;
  setHasLoadedNotifications: (v: boolean) => void;
};

export const useMessageNotificationStore = create<MessageNotificationStore>((set, get) => ({
  notifications: [],

  setNotifications: (notifications) => set({ notifications }),
  hasLoadedNotifications: false,
  setHasLoadedNotifications: (v) => set({ hasLoadedNotifications: v }),

  addNotificationFromApi: (incoming) => {
    // Duplikatkontroll basert på ID
    const existing = new Map(get().notifications.map((n) => [n.id, n]));
    incoming.forEach((n) => existing.set(n.id, n));
    set({ notifications: Array.from(existing.values()).slice(0, 50) });
  },

  upsertReactionNotification: (incoming, currentUserId) => {
    if (incoming.senderId === currentUserId) return false;

    const state = get();
    const isReaction = incoming.type === NotificationType.MessageReaction;

    if (!isReaction || incoming.messageId == null) return false;

    let wasNew = true;

    const updated = state.notifications.map((n) => {
        if (
        n.type === NotificationType.MessageReaction &&
        n.messageId === incoming.messageId
        ) {
        wasNew = false;
        return {
            ...n,
            ...incoming,
            id: n.id,
            createdAt: incoming.createdAt ?? n.createdAt,
        };
        }
        return n;
    });

    const finalList = wasNew
        ? [incoming, ...updated].slice(0, 50)
        : updated;

    set({ notifications: finalList });

    if (wasNew) {
        showNotificationToast({
        senderName: incoming.senderName,
        messagePreview: `Reagerte på meldingen din`,
        conversationId: incoming.conversationId!,
        type: NotificationType[incoming.type as keyof typeof NotificationType],
        reactionEmoji: incoming.reactionEmoji,
        });
    }

    return wasNew; // ✅ viktig!
    },

    upsertNotification: (incoming: MessageNotificationDTO) => {
  let wasNew = true;

  set((state) => {
    const existing = state.notifications.find((n) => n.id === incoming.id);
    wasNew = !existing;

    const merged: MessageNotificationDTO = existing
    ? {
        ...existing,
        ...incoming,
        messagePreview: incoming.messagePreview ?? existing.messagePreview,
        isRead: existing.isRead,
        readAt: existing.readAt,
      }
    : incoming;

    const withoutDupes = state.notifications.filter((n) => n.id !== incoming.id);

    const finalList = [merged, ...withoutDupes].slice(0, 50);


      if (wasNew && incoming.type === NotificationType.MessageRequestApproved) {
      showNotificationToast({
        senderName: incoming.senderName!,
        messagePreview: incoming.messagePreview!,
        conversationId: incoming.conversationId!,
        type: incoming.type,
        reactionEmoji: incoming.reactionEmoji,
      });
    }

    return {
      notifications: finalList,
    };
  });

  return wasNew;
},

  markAsRead: async (id: number) => {
    try {
        await markMessageNotificationAsRead(id);

        set((state) => ({
        notifications: state.notifications.map((n) =>
            n.id === id
            ? { ...n, isRead: true, readAt: new Date().toISOString() }
            : n
        ),
        }));
    } catch (err) {
        console.error("❌ Kunne ikke markere notification som lest:", err);
    }
    },

  markAllAsRead: () =>
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, isRead: true })),
    })),

    markAsReadForConversation: (conversationId: number) => {
        set((state) => {
            const updated = state.notifications.map((n) =>
            n.conversationId === conversationId
                ? { ...n, isRead: true, readAt: new Date().toISOString() }
                : n
            );

            return { notifications: updated };
        });
        },
}));