import { create } from "zustand";
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
  resetStore: () => void;
  updateMessageReactions: (reaction: ReactionDTO) => void;
  cleanupOldCache: () => void;
  pendingMessageRequests: MessageRequestDTO[];
  setPendingMessageRequests: (requests: MessageRequestDTO[]) => void;
  pendingRequestsCache: MessageRequestDTO[];
  pendingRequestsCacheTimestamp: number;
  setCachedPendingRequests: (requests: MessageRequestDTO[]) => void;
  removePendingRequest: (conversationId: number) => void;
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
};
// Lagre når endringer ble gjort for å slette cachen
export const useChatStore = create<ChatStore>((set) => ({
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
  setScrollToMessageId: (id) => set({ scrollToMessageId: id }),
  setShowNewMessageButton: (value: boolean) => set({ showNewMessageButton: value }),
  setIsAtBottom: (value) => set(() => ({ isAtBottom: value })),
  searchMode: false,
  setSearchMode: (value: boolean) => set(() => ({ searchMode: value })),
   setSearchResults: (messages: MessageDTO[]) => set(() => ({ searchResults: messages })),
  reactionsVersion: 0,
  bumpReactionsVersion: () => set((state) => ({ reactionsVersion: state.reactionsVersion + 1 })),
  pendingMessageRequests: [],
  pendingLockedConversationId: null,
  setPendingLockedConversationId: (id) => set({ pendingLockedConversationId: id }),
  setPendingMessageRequests: (requests) => set(() => ({
  pendingMessageRequests: [...requests].sort(
      (a, b) =>
        new Date(b.requestedAt).getTime() -
        new Date(a.requestedAt).getTime()
    )
  })),
  pendingRequestsCache: [],
  pendingRequestsCacheTimestamp: 0,
  hasLoadedPendingRequests: false,
  setHasLoadedPendingRequests: (value) => set({ hasLoadedPendingRequests: value }),
  hasLoadedUnreadConversationIds: false,
  setHasLoadedUnreadConversationIds: (v) => set({ hasLoadedUnreadConversationIds: v }), 

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

  removePendingRequest: (conversationId) =>
    set((state) => ({
      pendingMessageRequests: state.pendingMessageRequests.filter(
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


  setCurrentConversationId: (id) => set(() => ({ currentConversationId: id })),
  hasLoadedConversations: false,
  setHasLoadedConversations: (v) => set({ hasLoadedConversations: v }),
  

  setConversations: (conversations) =>
  set(() => ({
    conversations: [...conversations].sort(
      (a, b) =>
        new Date(b.lastMessageSentAt ?? 0).getTime() -
        new Date(a.lastMessageSentAt ?? 0).getTime()
    ),
  })),
  // Brukes for å åpne dropdown og gå til samtalen ved en notifikasjon
  openConversation: (conversationId: number) => {
    set(() => ({ currentConversationId: conversationId }));
  },

  showMessages: false,
  setShowMessages: (value: boolean) => set({ showMessages: value }),
  
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

      

      

    // Finn samtalen til meldingen – vi trenger conversationId
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

    // legger til samtale i samtaleliste ved godkjent meldingsforespørsel
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

        // Sorter etter sist sendt melding
        updated.sort(
          (a, b) =>
            new Date(b.lastMessageSentAt ?? 0).getTime() -
            new Date(a.lastMessageSentAt ?? 0).getTime()
        );

        return { conversations: updated };
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
    
    // Rydder opp cache etter en satt tid, brukes i CacheCleanup
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

          // Ikke slett cache for aktiv samtale
          if (convId === currentId) {
            newCachedMessages[convId] = state.cachedMessages[convId];
            newScrollPositions[convId] = state.scrollPositions[convId];
            newCacheTimestamps[convId] = state.cacheTimestamps[convId];
            continue;
          }

          // Behold hvis fortsatt gyldig
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
                 pendingRequestsCache: keepPendingCache
         ? state.pendingRequestsCache
         : [],
       pendingRequestsCacheTimestamp: keepPendingCache
         ? state.pendingRequestsCacheTimestamp
         : 0,
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

    resetStore: () => set(() => ({
      conversations: [],
      liveMessages: {},
      currentConversationId: null,
      cachedMessages: {},
      scrollPositions: {},
      cacheTimestamps: {},
      pendingMessageRequests: [],
    })),
}));
