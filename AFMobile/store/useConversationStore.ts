import { create } from "zustand";
import { persist, subscribeWithSelector, createJSONStorage } from "zustand/middleware";
import { asyncStorage } from "./indexedNotificationDBStorage";
import { ConversationDTO } from "@shared/types/ConversationDTO";

type ConversationStore = {
  conversations: ConversationDTO[];
  conversationIds: Set<number>;

  pendingConversations: ConversationDTO[];

  unreadConversationIds: number[];

  isPendingCollapsed: boolean;

  hasLoadedConversations: boolean;
  hasLoadedPendingConversations: boolean;
  hasLoadedUnreadConversationIds: boolean;

  // Conversation actions
  setConversations: (conversations: ConversationDTO[]) => void;
  addConversation: (conversation: ConversationDTO) => void;
  removeConversation: (conversationId: number) => void;
  updateConversation: (conversationId: number, updates: Partial<ConversationDTO>) => void;
  updateConversationTimestamp: (conversationId: number, timestamp: string) => void;

  // Pending conversation actions
  setPendingConversations: (conversations: ConversationDTO[]) => void;
  addPendingConversation: (conversation: ConversationDTO) => void;
  updatePendingConversation: (conversationId: number, updates: Partial<ConversationDTO>) => void;
  removePendingConversation: (conversationId: number) => void;

  // Unread actions
  setUnreadConversationIds: (ids: number[]) => void;
  markConversationAsReadLocally: (conversationId: number) => void;
  clearAllUnreadConversations: () => void;

  // Loading flags
  setHasLoadedConversations: (v: boolean) => void;
  setHasLoadedPendingConversations: (v: boolean) => void;
  setHasLoadedUnreadConversationIds: (v: boolean) => void;
  setIsPendingCollapsed: (value: boolean) => void;

  reset: () => void;
};

const sortByLastMessage = (conversations: ConversationDTO[]) =>
  [...conversations].sort(
    (a, b) =>
      new Date(b.lastMessageSentAt ?? 0).getTime() -
      new Date(a.lastMessageSentAt ?? 0).getTime()
  );

export const useConversationStore = create<ConversationStore>()(
  persist(
    subscribeWithSelector((set) => ({
      conversations: [],
      conversationIds: new Set<number>(),

      pendingConversations: [],

      unreadConversationIds: [],

      isPendingCollapsed: false,

      hasLoadedConversations: false,
      hasLoadedPendingConversations: false,
      hasLoadedUnreadConversationIds: false,

      setConversations: (conversations) =>
        set(() => {
          const sorted = sortByLastMessage(conversations);
          return {
            conversations: sorted,
            conversationIds: new Set(sorted.map((c) => c.id)),
          };
        }),

      addConversation: (conversation) =>
        set((state) => {
          const exists = state.conversations.some((c) => c.id === conversation.id);
          const updated = exists
            ? state.conversations.map((c) =>
                c.id === conversation.id ? { ...c, ...conversation } : c
              )
            : [...state.conversations, conversation];

          const sorted = sortByLastMessage(updated);
          return {
            conversations: sorted,
            conversationIds: new Set(sorted.map((c) => c.id)),
          };
        }),

      removeConversation: (conversationId) =>
        set((state) => {
          const conversations = state.conversations.filter((c) => c.id !== conversationId);
          return {
            conversations,
            conversationIds: new Set(conversations.map((c) => c.id)),
            unreadConversationIds: state.unreadConversationIds.filter((id) => id !== conversationId),
          };
        }),

      updateConversation: (conversationId, updates) =>
        set((state) => {
          const updated = state.conversations.map((conv) =>
            conv.id === conversationId ? { ...conv, ...updates } : conv
          );
          const sorted = updates.lastMessageSentAt ? sortByLastMessage(updated) : updated;
          return {
            conversations: sorted,
            conversationIds: new Set(sorted.map((c) => c.id)),
          };
        }),

      updateConversationTimestamp: (conversationId, timestamp) =>
        set((state) => {
          const updated = state.conversations.map((conv) =>
            conv.id === conversationId ? { ...conv, lastMessageSentAt: timestamp } : conv
          );
          return { conversations: sortByLastMessage(updated) };
        }),

      setPendingConversations: (conversations) =>
        set(() => ({
          pendingConversations: sortByLastMessage(conversations),
        })),

      addPendingConversation: (conversation) =>
        set((state) => {
          if (state.pendingConversations.some((c) => c.id === conversation.id)) {
            return {};
          }
          return {
            pendingConversations: sortByLastMessage([...state.pendingConversations, conversation]),
          };
        }),

      updatePendingConversation: (conversationId, updates) =>
        set((state) => {
          const updated = state.pendingConversations.map((c) =>
            c.id === conversationId ? { ...c, ...updates } : c
          );
          return { pendingConversations: updated };
        }),

      removePendingConversation: (conversationId) =>
        set((state) => ({
          pendingConversations: state.pendingConversations.filter((c) => c.id !== conversationId),
        })),

      setUnreadConversationIds: (ids) => set({ unreadConversationIds: ids }),

      markConversationAsReadLocally: (conversationId) =>
        set((state) => ({
          unreadConversationIds: state.unreadConversationIds.filter((id) => id !== conversationId),
        })),

      clearAllUnreadConversations: () => set({ unreadConversationIds: [] }),

      setHasLoadedConversations: (v) => set({ hasLoadedConversations: v }),
      setHasLoadedPendingConversations: (v) => set({ hasLoadedPendingConversations: v }),
      setHasLoadedUnreadConversationIds: (v) => set({ hasLoadedUnreadConversationIds: v }),
      setIsPendingCollapsed: (value) => set({ isPendingCollapsed: value }),

      reset: () =>
        set({
          conversations: [],
          conversationIds: new Set<number>(),
          pendingConversations: [],
          unreadConversationIds: [],
          isPendingCollapsed: false,
          hasLoadedConversations: false,
          hasLoadedPendingConversations: false,
          hasLoadedUnreadConversationIds: false,
        }),
    })),
    {
      name: "conversation-cache",
      storage: createJSONStorage(() => asyncStorage),

      partialize: (state) => ({
        conversations: state.conversations,
        conversationIds: Array.from(state.conversationIds),
        pendingConversations: state.pendingConversations,
        unreadConversationIds: state.unreadConversationIds,
        isPendingCollapsed: state.isPendingCollapsed,
        hasLoadedConversations: state.hasLoadedConversations,
        hasLoadedPendingConversations: state.hasLoadedPendingConversations,
        hasLoadedUnreadConversationIds: state.hasLoadedUnreadConversationIds,
      }),

      onRehydrateStorage: () => (state) => {
        if (state && Array.isArray(state.conversationIds)) {
          state.conversationIds = new Set(state.conversationIds);
        }
      },

      version: 4,
      migrate: () => ({
        conversations: [],
        conversationIds: new Set<number>(),
        pendingConversations: [],
        unreadConversationIds: [],
        isPendingCollapsed: false,
        hasLoadedConversations: false,
        hasLoadedPendingConversations: false,
        hasLoadedUnreadConversationIds: false,
      }),
    }
  )
);
