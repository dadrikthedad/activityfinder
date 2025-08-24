import { create } from "zustand";
import { persist, subscribeWithSelector, createJSONStorage } from "zustand/middleware";
import { asyncStorage } from "./indexedNotificationDBStorage";
import { MessageNotificationDTO, NotificationType } from "@shared/types/MessageNotificationDTO";
import { showNotificationToastNative } from "@/components/toast/NotificationToastNative";
import { markMessageNotificationAsRead } from "@/services/messages/messageNotificationService";

// TODO: Må komme tilbake etter toast

type MessageNotificationStore = {
  messageNotifications: MessageNotificationDTO[];
  setMessageNotifications: (notifications: MessageNotificationDTO[]) => void;
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
      messageNotifications: [],
      hasLoadedNotifications: false,

      setMessageNotifications: (notifications) => set({ messageNotifications: notifications }),
      setHasLoadedNotifications: (v) => set({ hasLoadedNotifications: v }),

      addNotificationFromApi: (incoming) => {
        // Duplikatkontroll basert på ID
        const existing = new Map(get().messageNotifications.map((n) => [n.id, n]));
        incoming.forEach((n) => existing.set(n.id, n));
        set({ messageNotifications: Array.from(existing.values()).slice(0, 50) });
      },

      upsertNotification: (incoming: MessageNotificationDTO) => {
        let wasNew = true;

        set((state) => {
          const existing = state.messageNotifications.find((n) => n.id === incoming.id);
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

          const withoutDupes = state.messageNotifications.filter((n) => n.id !== incoming.id);
          const finalList = [merged, ...withoutDupes].slice(0, 50);

          if (wasNew && incoming.type === NotificationType.MessageRequestApproved) {
            showNotificationToastNative({
              senderName: incoming.senderName!,
              messagePreview: incoming.messagePreview!,
              conversationId: incoming.conversationId!,
              type: incoming.type,
              reactionEmoji: incoming.reactionEmoji,
            });
          }

          return {
            messageNotifications: finalList,
          };
        });

        return wasNew;
      },

      markAsRead: async (id: number) => {
        try {
          await markMessageNotificationAsRead(id);

          set((state) => ({
            messageNotifications: state.messageNotifications.map((n) =>
              n.id === id
                ? { ...n, isRead: true, readAt: new Date().toISOString() }
                : n
            ),
          }));
        } catch (err) {
          console.error("❌ Kunne ikke markere notification som lest:", err);
        }
      },

      markAllAsRead: () => {
        set((state) => ({
          messageNotifications: state.messageNotifications.map((n) => ({ ...n, isRead: true })),
        }));

        // 🆕 Oppdater ChatStore som bieffekt
        const { clearAllUnreadConversations } = require('./useChatStore').useChatStore.getState();
        clearAllUnreadConversations();
      },
        

      markAsReadForConversation: (conversationId: number) => {
        console.log('🔍 markAsReadForConversation called with conversationId:', conversationId);
        
        set((state) => {
          // Debug: Se hvilke notifikasjoner vi har for denne samtalen
          const conversationNotifications = state.messageNotifications.filter(n => n.conversationId === conversationId);
          
          console.log('📋 Found notifications for conversation:', conversationNotifications.map(n => ({ 
            id: n.id, 
            type: n.type, 
            conversationId: n.conversationId,
            isRead: n.isRead,
            messagePreview: n.messagePreview?.substring(0, 50) + '...'
          })));

          // Debug: Se hvilke som er GroupEvent spesifikt
          const groupEvents = conversationNotifications.filter(n => n.type === 'GroupEvent');
          console.log('🎭 GroupEvent notifications found:', groupEvents.length, groupEvents.map(n => ({
            id: n.id,
            isRead: n.isRead,
            eventCount: n.eventCount,
            groupName: n.groupName
          })));

          const updated = state.messageNotifications.map((n) =>
            n.conversationId === conversationId
              ? { ...n, isRead: true, readAt: new Date().toISOString() }
              : n
          );

          // Debug: Se hva som ble oppdatert
          const updatedConversationNotifications = updated.filter(n => n.conversationId === conversationId);
          console.log('✅ After update - notifications now marked as read:', updatedConversationNotifications.map(n => ({
            id: n.id,
            type: n.type,
            isRead: n.isRead,
            readAt: n.readAt
          })));

          return { messageNotifications: updated };
        });
    },

      updateNotificationsForRejectedConversation: (conversationId: number) => {
        set((state) => ({
          messageNotifications: state.messageNotifications.map((notification) =>
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
          messageNotifications: [],
          hasLoadedNotifications: false,
          seenReactions: {},
        }),
    })),
    {
      name: "message-notif-cache",
      storage: createJSONStorage(() => asyncStorage),

      /**
       * partialize: begrens hvor mye som lagres.
       * - 50 siste notifikasjoner (matcher slice(0, 50) logikken)
       */
      partialize: (state) => ({
        messageNotifications: state.messageNotifications.slice(0, 50),
        hasLoadedNotifications: state.hasLoadedNotifications,
      }),

      version: 1,
      migrate: (persisted) => persisted as MessageNotificationStore,
    }
  )
);