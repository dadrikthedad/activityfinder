import { create } from "zustand";
import { persist, subscribeWithSelector, createJSONStorage } from "zustand/middleware";
import { indexedDBStorage } from "./indexedNotificationDBStorage";
import { MessageDTO, ReactionDTO } from "@/types/MessageDTO";
import { ConversationDTO } from "@/types/ConversationDTO";
import { MessageRequestDTO } from "@/types/MessageReqeustDTO";
import { useMessageNotificationStore } from "./useMessageNotificationStore";

type ChatStore = {
  conversations: ConversationDTO[];
  liveMessages: Record<number, MessageDTO[]>;
  currentConversationId: number | null;
  setCurrentConversationId: (id: number | null) => void;
  setConversations: (conversations: ConversationDTO[]) => void;
  conversationIds: Set<number>;
  addMessage: (message: MessageDTO) => void;
  clearLiveMessages: (conversationId: number) => void;
  updateConversationTimestamp: (conversationId: number, timestamp: string) => void;
  cachedMessages: Record<number, MessageDTO[]>;
  setCachedMessages: (conversationId: number, messages: MessageDTO[]) => void;
  scrollPositions: Record<number, number>;
  setScrollPosition: (conversationId: number, position: number) => void;
  cacheTimestamps: Record<number, number>;
  searchMode: boolean;
  setSearchMode: (value: boolean) => void;
  updateMessage: (conversationId: number, messageId: number, updatedMessage: MessageDTO) => void; 
  updateMessageReactions: (reaction: ReactionDTO) => void;
  cleanupOldCache: () => void;
  pendingMessageRequests: MessageRequestDTO[];
  setPendingMessageRequests: (requests: MessageRequestDTO[]) => void;
  pendingRequestsCache: MessageRequestDTO[];
  pendingRequestsCacheTimestamp: number;
  setCachedPendingRequests: (requests: MessageRequestDTO[]) => void;
  removePendingRequest: (conversationId: number) => void;
  removeConversation: (conversationId: number) => void;
  addConversation: (conversation: ConversationDTO) => void;
  setPendingLockedConversationId: (id: number | null) => void;
  pendingLockedConversationId: number | null;
  searchResults: MessageDTO[];
  setSearchResults: (messages: MessageDTO[]) => void;
  updateSearchResultReactions: (reaction: ReactionDTO) => void;
  unreadConversationIds: number[];
  setUnreadConversationIds: (ids: number[]) => void;
  markConversationAsReadLocally: (conversationId: number) => void;
  isAtBottom: boolean;
  setIsAtBottom: (value: boolean) => void;
  reactionsVersion: number;
  bumpReactionsVersion: () => void;
  showNewMessageButton: boolean;
  setShowNewMessageButton: (value: boolean) => void;
  scrollToMessageId: number | null;
  setScrollToMessageId: (id: number | null) => void;
  addPendingRequest: (request: MessageRequestDTO) => void;
  hasLoadedPendingRequests: boolean;
  setHasLoadedPendingRequests: (value: boolean) => void;
  hasLoadedConversations: boolean;
  setHasLoadedConversations: (v: boolean) => void;
  hasLoadedUnreadConversationIds: boolean;
  setHasLoadedUnreadConversationIds: (v: boolean) => void;
  openConversation: (conversationId: number) => void;
  showMessages: boolean;
  setShowMessages: (value: boolean) => void;
  updateConversation: (conversationId: number, updates: Partial<ConversationDTO>) => void;
  
  /** Tøm alt ved logout */
  reset: () => void;
};

export const useChatStore = create<ChatStore>()(
  persist(
    subscribeWithSelector((set) => ({
      // --- initial state ---
      conversations: [],
      liveMessages: {},
      currentConversationId: null,
      cachedMessages: {},
      scrollPositions: {},
      cacheTimestamps: {},
      searchResults: [],
      unreadConversationIds: [],
      isAtBottom: true,
      showNewMessageButton: false,
      scrollToMessageId: null,
      conversationIds: new Set<number>(),
      searchMode: false,
      reactionsVersion: 0,
      pendingMessageRequests: [],
      pendingLockedConversationId: null,
      pendingRequestsCache: [],
      pendingRequestsCacheTimestamp: 0,
      hasLoadedPendingRequests: false,
      hasLoadedUnreadConversationIds: false,
      hasLoadedConversations: false,
      showMessages: false,

      // --- setters ---
      setScrollToMessageId: (id) => set({ scrollToMessageId: id }),
      setShowNewMessageButton: (value: boolean) => set({ showNewMessageButton: value }),
      setIsAtBottom: (value) => set(() => ({ isAtBottom: value })),
      setSearchMode: (value: boolean) => set(() => ({ searchMode: value })),
      setSearchResults: (messages: MessageDTO[]) => set(() => ({ searchResults: messages })),
      bumpReactionsVersion: () => set((state) => ({ reactionsVersion: state.reactionsVersion + 1 })),
      setPendingLockedConversationId: (id) => set({ pendingLockedConversationId: id }),
      setHasLoadedPendingRequests: (value) => set({ hasLoadedPendingRequests: value }),
      setHasLoadedUnreadConversationIds: (v) => set({ hasLoadedUnreadConversationIds: v }),
      setCurrentConversationId: (id) => set(() => ({ currentConversationId: id })),
      setHasLoadedConversations: (v) => set({ hasLoadedConversations: v }),
      setShowMessages: (value: boolean) => set({ showMessages: value }),

      setPendingMessageRequests: (requests) => set(() => ({
        pendingMessageRequests: [...requests].sort(
          (a, b) =>
            new Date(b.requestedAt).getTime() -
            new Date(a.requestedAt).getTime()
        )
      })),

      setCachedPendingRequests: (requests: MessageRequestDTO[]) =>
        set({
          pendingRequestsCache: requests,
          pendingRequestsCacheTimestamp: Date.now(),
        }),

      addPendingRequest: (request: MessageRequestDTO) =>
        set((state) => {
          const alreadyExists = state.pendingMessageRequests.some(
            (r) => r.conversationId === request.conversationId
          );

          if (alreadyExists) return {};

          const updated = [...state.pendingMessageRequests, request].sort(
            (a, b) =>
              new Date(b.requestedAt).getTime() -
              new Date(a.requestedAt).getTime()
          );

          return {
            pendingMessageRequests: updated,
            pendingRequestsCache: updated,
            pendingRequestsCacheTimestamp: Date.now(),
          };
        }),

      removePendingRequest: (conversationId: number) =>
        set((state) => ({
          pendingMessageRequests: state.pendingMessageRequests.filter(
            (r) => r.conversationId !== conversationId
          ),
          pendingRequestsCache: state.pendingRequestsCache.filter(
            (r) => r.conversationId !== conversationId
          )
        })),

      setUnreadConversationIds: (ids) => {
        console.log("🔔 Setter unreadConversationIds i store:", ids);
        set({ unreadConversationIds: ids });
      },

      markConversationAsReadLocally: (conversationId) => {
        useMessageNotificationStore.getState().markAsReadForConversation(conversationId);

        set((state) => ({
          unreadConversationIds: state.unreadConversationIds.filter((id) => id !== conversationId),
        }));
      },

      setConversations: (conversations) =>
        set(() => ({
          conversations: [...conversations].sort(
            (a, b) =>
              new Date(b.lastMessageSentAt ?? 0).getTime() -
              new Date(a.lastMessageSentAt ?? 0).getTime()
          ),
          conversationIds: new Set(conversations.map(c => c.id)),
        })),

      openConversation: (conversationId: number) => {
        set(() => ({ currentConversationId: conversationId }));
      },

      updateConversation: (conversationId: number, updates: Partial<ConversationDTO>) =>
        set((state) => {
          console.log(`📝 Updating conversation ${conversationId} with:`, updates);
          
          const updatedConversations = state.conversations.map((conv) =>
            conv.id === conversationId 
              ? { ...conv, ...updates }
              : conv
          );

          // Sort conversations by lastMessageSentAt if that was updated
          if (updates.lastMessageSentAt) {
            updatedConversations.sort(
              (a, b) =>
                new Date(b.lastMessageSentAt ?? 0).getTime() -
                new Date(a.lastMessageSentAt ?? 0).getTime()
            );
          }

          return { 
            conversations: updatedConversations,
            conversationIds: new Set(updatedConversations.map(c => c.id))
          };
        }),

      updateSearchResultReactions: (reaction: ReactionDTO) =>
        set((state) => {
          const updatedMessages = state.searchResults.map((m) => {
            if (m.id !== reaction.messageId) return m;

            const existing = m.reactions ?? [];
            const filtered = existing.filter((r) => r.userId !== reaction.userId);

            if (!reaction.isRemoved) {
              filtered.push(reaction);
            }

            return { ...m, reactions: filtered };
          });

          return { searchResults: updatedMessages };
        }),

        updateMessage: (conversationId: number, messageId: number, updatedMessage: MessageDTO) =>
          set((state) => {
            console.log(`🔄 Oppdaterer melding ${messageId} i samtale ${conversationId}:`, updatedMessage);
            
            const updateMessages = (messages: MessageDTO[]) =>
              messages.map((m) => m.id === messageId ? updatedMessage : m);

            const liveMessages = { ...state.liveMessages };
            const cachedMessages = { ...state.cachedMessages };

            // Oppdater i liveMessages hvis meldingen finnes der
            if (state.liveMessages[conversationId]) {
              const hasMessage = state.liveMessages[conversationId].some(m => m.id === messageId);
              if (hasMessage) {
                liveMessages[conversationId] = updateMessages(state.liveMessages[conversationId]);
                console.log(`✅ Oppdatert melding ${messageId} i liveMessages`);
              }
            }

            // Oppdater i cachedMessages hvis meldingen finnes der
            if (state.cachedMessages[conversationId]) {
              const hasMessage = state.cachedMessages[conversationId].some(m => m.id === messageId);
              if (hasMessage) {
                cachedMessages[conversationId] = updateMessages(state.cachedMessages[conversationId]);
                console.log(`✅ Oppdatert melding ${messageId} i cachedMessages`);
              }
            }

            return {
              liveMessages,
              cachedMessages,
            };
          }),

      updateMessageReactions: (reaction: ReactionDTO) =>
        set((state) => {
          console.log("🔁 Oppdaterer reaction i store:", reaction);
          const updateMessages = (messages: MessageDTO[]) =>
            messages.map((m) => {
              if (m.id !== reaction.messageId) return m;

              const existing = m.reactions ?? [];
              const filtered = existing.filter((r) => r.userId !== reaction.userId);

              if (!reaction.isRemoved) {
                filtered.push(reaction);
              }

              return { ...m, reactions: filtered };
            });

          const liveMessages = { ...state.liveMessages };
          const cachedMessages = { ...state.cachedMessages };

          for (const [convId, msgs] of Object.entries(state.liveMessages)) {
            if (msgs.some((m) => m.id === reaction.messageId)) {
              liveMessages[+convId] = updateMessages(msgs);
            }
          }

          for (const [convId, msgs] of Object.entries(state.cachedMessages)) {
            if (msgs.some((m) => m.id === reaction.messageId)) {
              cachedMessages[+convId] = updateMessages(msgs);
            }
          }

          return {
            liveMessages,
            cachedMessages,
            reactionsVersion: state.reactionsVersion + 1,
          };
        }),

      setCachedMessages: (conversationId, messages) =>
        set((state) => ({
          cachedMessages: {
            ...state.cachedMessages,
            [conversationId]: messages,
          },
          cacheTimestamps: {
            ...state.cacheTimestamps,
            [conversationId]: Date.now(),
          },
        })),

      setScrollPosition: (conversationId, position) =>
        set((state) => ({
          scrollPositions: {
            ...state.scrollPositions,
            [conversationId]: position,
          },
        })),

      addConversation: (conversation) =>
        set((state) => {
          const exists = state.conversations.some((c) => c.id === conversation.id);
          let updated;

          if (exists) {
            updated = state.conversations.map((c) =>
              c.id === conversation.id ? { ...c, ...conversation } : c
            );
          } else {
            updated = [...state.conversations, conversation];
          }

          updated.sort(
            (a, b) =>
              new Date(b.lastMessageSentAt ?? 0).getTime() -
              new Date(a.lastMessageSentAt ?? 0).getTime()
          );

          return { conversations: updated, conversationIds: new Set(updated.map(c => c.id)) };
        }),

      updateConversationTimestamp: (conversationId: number, timestamp: string) =>
        set((state) => {
          const updatedConversations = state.conversations.map((conv) =>
            conv.id === conversationId ? { ...conv, lastMessageSentAt: timestamp } : conv
          );

          updatedConversations.sort(
            (a, b) =>
              new Date(b.lastMessageSentAt ?? 0).getTime() -
              new Date(a.lastMessageSentAt ?? 0).getTime()
          );

          return { conversations: updatedConversations };
        }),

      removeConversation: (conversationId: number) =>
        set((state) => ({
          conversations: state.conversations.filter((c) => c.id !== conversationId),
          conversationIds: new Set(
            Array.from(state.conversationIds).filter((id) => id !== conversationId)
          ),
          cachedMessages: Object.fromEntries(
            Object.entries(state.cachedMessages).filter(([id]) => +id !== conversationId)
          ),
          scrollPositions: Object.fromEntries(
            Object.entries(state.scrollPositions).filter(([id]) => +id !== conversationId)
          ),
          cacheTimestamps: Object.fromEntries(
            Object.entries(state.cacheTimestamps).filter(([id]) => +id !== conversationId)
          ),
          liveMessages: Object.fromEntries(
            Object.entries(state.liveMessages).filter(([id]) => +id !== conversationId)
          ),
          unreadConversationIds: state.unreadConversationIds.filter(id => id !== conversationId),
        })),

      cleanupOldCache: () =>
        set((state) => {
          console.log("🧹 Running cleanupOldCache at", new Date().toLocaleTimeString());

          const now = Date.now();
          const TTL = 1000 * 60 * 10; // 10 minutter

          const newCachedMessages: typeof state.cachedMessages = {};
          const newScrollPositions: typeof state.scrollPositions = {};
          const newCacheTimestamps: typeof state.cacheTimestamps = {};
          const currentId = state.currentConversationId;

          for (const id in state.cacheTimestamps) {
            const convId = +id;

            if (convId === currentId) {
              newCachedMessages[convId] = state.cachedMessages[convId];
              newScrollPositions[convId] = state.scrollPositions[convId];
              newCacheTimestamps[convId] = state.cacheTimestamps[convId];
              continue;
            }

            if (now - state.cacheTimestamps[convId] < TTL) {
              newCachedMessages[convId] = state.cachedMessages[convId];
              newScrollPositions[convId] = state.scrollPositions[convId];
              newCacheTimestamps[convId] = state.cacheTimestamps[convId];
            }
          }

          const cacheAge = now - state.pendingRequestsCacheTimestamp;
          const keepPendingCache = cacheAge < TTL;

          return {
            cachedMessages: newCachedMessages,
            scrollPositions: newScrollPositions,
            cacheTimestamps: newCacheTimestamps,
            pendingRequestsCache: keepPendingCache ? state.pendingRequestsCache : [],
            pendingRequestsCacheTimestamp: keepPendingCache ? state.pendingRequestsCacheTimestamp : 0,
          };
        }),

      addMessage: (message) =>
        set((state) => {
          console.log("🔔 addMessage called with:", message);
          const current = state.liveMessages[message.conversationId] ?? [];
          const alreadyExists = current.some((m) => m.id === message.id);
          if (alreadyExists) {
            console.log("⚠️ Message already exists, skipping:", message.id);
            return state;
          }

          const updated = {
            ...state.liveMessages,
            [message.conversationId]: [...current, message],
          };

          console.log("✅ Message added to liveMessages:", updated[message.conversationId]);

          return {
            liveMessages: updated,
          };
        }),

      clearLiveMessages: (conversationId) =>
        set((state) => {
          const copy = { ...state.liveMessages };
          delete copy[conversationId];
          return { liveMessages: copy };
        }),



      // --- full reset (bruk ved logout) ---
      reset: () =>
        set({
          conversations: [],
          liveMessages: {},
          currentConversationId: null,
          cachedMessages: {},
          scrollPositions: {},
          cacheTimestamps: {},
          pendingMessageRequests: [],
          searchResults: [],
          unreadConversationIds: [],
          conversationIds: new Set<number>(),
          pendingRequestsCache: [],
          pendingRequestsCacheTimestamp: 0,
          hasLoadedPendingRequests: false,
          hasLoadedConversations: false,
          hasLoadedUnreadConversationIds: false,
          isAtBottom: true,
          showNewMessageButton: false,
          scrollToMessageId: null,
          searchMode: false,
          reactionsVersion: 0,
          pendingLockedConversationId: null,
          showMessages: false,
        }),
    })),
    {
      name: "chat-cache",
      storage: createJSONStorage(() => indexedDBStorage),

      /**
       * partialize: begrens hvor mye som lagres.
       * - conversations (alle)
       * - cachedMessages (begrenset til siste 100 per samtale)
       * - liveMessages (begrenset til siste 50 per samtale) ✅ LAGRES NÅ
       * - scrollPositions (alle)
       * - pendingRequestsCache (alle)
       * - loading states
       * - unreadConversationIds
       * 
       * IKKE lagre:
       * - searchResults (midlertidige)
       * - UI state (isAtBottom, showNewMessageButton, etc.)
       */
      partialize: (state) => {
        // Begrens cachedMessages til max 100 meldinger per samtale
        const limitedCachedMessages: Record<number, MessageDTO[]> = {};
        for (const [convId, messages] of Object.entries(state.cachedMessages)) {
          limitedCachedMessages[+convId] = messages.slice(-100); // Behold siste 100
        }

        // Begrens liveMessages til max 50 meldinger per samtale
        const limitedLiveMessages: Record<number, MessageDTO[]> = {};
        for (const [convId, messages] of Object.entries(state.liveMessages)) {
          limitedLiveMessages[+convId] = messages.slice(-50); // Behold siste 50
        }

        return {
          conversations: state.conversations,
          cachedMessages: limitedCachedMessages,
          liveMessages: limitedLiveMessages, // ✅ LAGRES NÅ
          scrollPositions: state.scrollPositions,
          cacheTimestamps: state.cacheTimestamps,
          pendingRequestsCache: state.pendingRequestsCache,
          pendingRequestsCacheTimestamp: state.pendingRequestsCacheTimestamp,
          unreadConversationIds: state.unreadConversationIds,
          conversationIds: Array.from(state.conversationIds), // Set kan ikke serialiseres direkte
          hasLoadedPendingRequests: state.hasLoadedPendingRequests,
          hasLoadedConversations: state.hasLoadedConversations,
          hasLoadedUnreadConversationIds: state.hasLoadedUnreadConversationIds,
        };
      },

      // Håndter deserialisering av Set
      onRehydrateStorage: () => (state) => {
        if (state && Array.isArray(state.conversationIds)) {
          state.conversationIds = new Set(state.conversationIds);
        }
      },

      version: 1,
      migrate: (persisted: unknown) => {
        // Sørg for at conversationIds er et Set
        const state = persisted as Partial<ChatStore>;
        if (state && Array.isArray(state.conversationIds)) {
          state.conversationIds = new Set(state.conversationIds);
        }
        return state as ChatStore;
      },
    }
  )
);