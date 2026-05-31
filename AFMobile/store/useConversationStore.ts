import { create } from "zustand";
import { persist, subscribeWithSelector, createJSONStorage } from "zustand/middleware";
import { asyncStorage } from "./indexedNotificationDBStorage";
import { ConversationDTO } from "@shared/types/ConversationDTO";
import { MessageRequestDTO } from "@shared/types/MessageReqeustDTO";

type ConversationStore = {
  conversations: ConversationDTO[];
  conversationIds: Set<number>;

  pendingMessageRequests: MessageRequestDTO[];
  pendingRequestsCache: MessageRequestDTO[];
  pendingRequestsCacheTimestamp: number;
  pendingLockedConversationId: number | null;

  unreadConversationIds: number[];

  isPendingCollapsed: boolean;

  hasLoadedConversations: boolean;
  hasLoadedPendingRequests: boolean;
  hasLoadedUnreadConversationIds: boolean;

  // Conversation actions
  setConversations: (conversations: ConversationDTO[]) => void;
  addConversation: (conversation: ConversationDTO) => void;
  removeConversation: (conversationId: number) => void;
  updateConversation: (conversationId: number, updates: Partial<ConversationDTO>) => void;
  updateConversationTimestamp: (conversationId: number, timestamp: string) => void;

  // Pending request actions
  setPendingMessageRequests: (requests: MessageRequestDTO[]) => void;
  setCachedPendingRequests: (requests: MessageRequestDTO[]) => void;
  addPendingRequest: (request: MessageRequestDTO) => void;
  updatePendingRequest: (conversationId: number, updates: Partial<MessageRequestDTO>) => void;
  removePendingRequest: (conversationId: number) => void;
  setPendingLockedConversationId: (id: number | null) => void;

  // Unread actions
  setUnreadConversationIds: (ids: number[]) => void;
  markConversationAsReadLocally: (conversationId: number) => void;
  clearAllUnreadConversations: () => void;

  // Loading flags
  setHasLoadedConversations: (v: boolean) => void;
  setHasLoadedPendingRequests: (v: boolean) => void;
  setHasLoadedUnreadConversationIds: (v: boolean) => void;
  setIsPendingCollapsed: (value: boolean) => void;

  /** Tøm alt ved logout */
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

      pendingMessageRequests: [],
      pendingRequestsCache: [],
      pendingRequestsCacheTimestamp: 0,
      pendingLockedConversationId: null,

      unreadConversationIds: [],

      isPendingCollapsed: false,

      hasLoadedConversations: false,
      hasLoadedPendingRequests: false,
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

      setPendingMessageRequests: (requests) =>
        set(() => ({
          pendingMessageRequests: [...requests].sort(
            (a, b) =>
              new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime()
          ),
        })),

      setCachedPendingRequests: (requests) =>
        set(() => ({
          pendingRequestsCache: requests,
          pendingRequestsCacheTimestamp: Date.now(),
        })),

      addPendingRequest: (request) =>
        set((state) => {
          if (state.pendingMessageRequests.some((r) => r.conversationId === request.conversationId)) {
            return {};
          }
          const updated = [...state.pendingMessageRequests, request].sort(
            (a, b) =>
              new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime()
          );
          return {
            pendingMessageRequests: updated,
            pendingRequestsCache: updated,
            pendingRequestsCacheTimestamp: Date.now(),
          };
        }),

      updatePendingRequest: (conversationId, updates) =>
        set((state) => {
          const updated = state.pendingMessageRequests.map((r) =>
            r.conversationId === conversationId ? { ...r, ...updates } : r
          );
          const changed = updated.some((r, i) => r !== state.pendingMessageRequests[i]);
          if (!changed) return {};
          return {
            pendingMessageRequests: updated,
            pendingRequestsCache: updated,
            pendingRequestsCacheTimestamp: Date.now(),
          };
        }),

      removePendingRequest: (conversationId) =>
        set((state) => ({
          pendingMessageRequests: state.pendingMessageRequests.filter(
            (r) => r.conversationId !== conversationId
          ),
          pendingRequestsCache: state.pendingRequestsCache.filter(
            (r) => r.conversationId !== conversationId
          ),
        })),

      setPendingLockedConversationId: (id) => set({ pendingLockedConversationId: id }),

      setUnreadConversationIds: (ids) => set({ unreadConversationIds: ids }),

      markConversationAsReadLocally: (conversationId) =>
        set((state) => ({
          unreadConversationIds: state.unreadConversationIds.filter((id) => id !== conversationId),
        })),

      clearAllUnreadConversations: () => set({ unreadConversationIds: [] }),

      setHasLoadedConversations: (v) => set({ hasLoadedConversations: v }),
      setHasLoadedPendingRequests: (v) => set({ hasLoadedPendingRequests: v }),
      setHasLoadedUnreadConversationIds: (v) => set({ hasLoadedUnreadConversationIds: v }),
      setIsPendingCollapsed: (value) => set({ isPendingCollapsed: value }),

      reset: () =>
        set({
          conversations: [],
          conversationIds: new Set<number>(),
          pendingMessageRequests: [],
          pendingRequestsCache: [],
          pendingRequestsCacheTimestamp: 0,
          pendingLockedConversationId: null,
          unreadConversationIds: [],
          isPendingCollapsed: false,
          hasLoadedConversations: false,
          hasLoadedPendingRequests: false,
          hasLoadedUnreadConversationIds: false,
        }),
    })),
    {
      name: "conversation-cache",
      storage: createJSONStorage(() => asyncStorage),

      partialize: (state) => ({
        conversations: state.conversations,
        conversationIds: Array.from(state.conversationIds),
        pendingMessageRequests: state.pendingMessageRequests,
        pendingRequestsCache: state.pendingRequestsCache,
        pendingRequestsCacheTimestamp: state.pendingRequestsCacheTimestamp,
        unreadConversationIds: state.unreadConversationIds,
        isPendingCollapsed: state.isPendingCollapsed,
        hasLoadedConversations: state.hasLoadedConversations,
        hasLoadedPendingRequests: state.hasLoadedPendingRequests,
        hasLoadedUnreadConversationIds: state.hasLoadedUnreadConversationIds,
      }),

      onRehydrateStorage: () => (state) => {
        if (state && Array.isArray(state.conversationIds)) {
          state.conversationIds = new Set(state.conversationIds);
        }
      },

      version: 1,
      migrate: (persisted: unknown) => {
        const state = persisted as Partial<ConversationStore>;
        if (state && Array.isArray(state.conversationIds)) {
          state.conversationIds = new Set(state.conversationIds);
        }
        return state as ConversationStore;
      },
    }
  )
);
