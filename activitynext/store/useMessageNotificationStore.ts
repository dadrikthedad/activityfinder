import { create } from "zustand";
import { persist, subscribeWithSelector, createJSONStorage } from "zustand/middleware";
import { indexedDBStorage } from "./indexedNotificationDBStorage";
import { MessageNotificationDTO, NotificationType } from "@/types/MessageNotificationDTO";
import { showNotificationToast } from "@/components/toast/Toast";
import { markMessageNotificationAsRead } from "@/services/messages/messageNotificationService";

type MessageNotificationStore = {
  notifications: MessageNotificationDTO[];
  setNotifications: (notifications: MessageNotificationDTO[]) => void;
  addNotificationFromApi: (notifications: MessageNotificationDTO[]) => void;
  upsertNotification: (incoming: MessageNotificationDTO) => boolean;
  markAsRead: (id: number) => Promise<void>;
  markAllAsRead: () => void;
  markAsReadForConversation: (conversationId: number) => void;
  updateNotificationsForRejectedConversation: (conversationId: number) => void;
  hasLoadedNotifications: boolean;
  setHasLoadedNotifications: (v: boolean) => void;
  seenReactions: Record<string, boolean>;
  markReactionSeen: (messageId: number, userId: number) => void;
  hasSeenReaction: (messageId: number, userId: number) => boolean;
  
  /** Tøm alt ved logout */
  reset: () => void;
};

export const useMessageNotificationStore = create<MessageNotificationStore>()(
  persist(
    subscribeWithSelector((set, get) => ({
      // --- initial state ---
      notifications: [],
      hasLoadedNotifications: false,

      setNotifications: (notifications) => set({ notifications }),
      setHasLoadedNotifications: (v) => set({ hasLoadedNotifications: v }),

      addNotificationFromApi: (incoming) => {
        // Duplikatkontroll basert på ID
        const existing = new Map(get().notifications.map((n) => [n.id, n]));
        incoming.forEach((n) => existing.set(n.id, n));
        set({ notifications: Array.from(existing.values()).slice(0, 50) });
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

      updateNotificationsForRejectedConversation: (conversationId: number) => {
        set((state) => ({
          notifications: state.notifications.map((notification) =>
            notification.conversationId === conversationId
              ? {
                  ...notification,
                  isConversationRejected: true,
                  isRead: true,
                  readAt: new Date().toISOString(),
                }
              : notification
          ),
        }));

        console.log(`🔄 Markerte notifikasjoner som avslått og lest for samtale: ${conversationId}`);
      },

      seenReactions: {},

      markReactionSeen: (messageId, userId) => {
        const key = `${messageId}-${userId}`;
        const current = get().seenReactions;
        if (!current[key]) {
          set({ seenReactions: { ...current, [key]: true } });
        }
      },

      hasSeenReaction: (messageId, userId) => {
        const key = `${messageId}-${userId}`;
        return !!get().seenReactions[key];
      },
      

      // --- full reset (bruk ved logout) ---
      reset: () =>
        set({
          notifications: [],
          hasLoadedNotifications: false,
          seenReactions: {},
        }),
    })),
    {
      name: "message-notif-cache",
      storage: createJSONStorage(() => indexedDBStorage),

      /**
       * partialize: begrens hvor mye som lagres.
       * - 50 siste notifikasjoner (matcher slice(0, 50) logikken)
       */
      partialize: (state) => ({
        notifications: state.notifications.slice(0, 50),
        hasLoadedNotifications: state.hasLoadedNotifications,
      }),

      version: 1,
      migrate: (persisted) => persisted as MessageNotificationStore,
    }
  )
);