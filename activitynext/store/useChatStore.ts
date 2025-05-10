import { create } from "zustand";
import { MessageDTO, ReactionDTO } from "@/types/MessageDTO";
import { ConversationDTO } from "@/types/ConversationDTO";


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
  resetStore: () => void;
  updateMessageReactions: (reaction: ReactionDTO) => void;
  cleanupOldCache: () => void;
};
// Lagre når endringer ble gjort for å slette cachen
export const useChatStore = create<ChatStore>((set) => ({
  conversations: [],
  liveMessages: {},
  currentConversationId: null,
  cachedMessages: {},
  scrollPositions: {},
  cacheTimestamps: {},

  setCurrentConversationId: (id) => set(() => ({ currentConversationId: id })),

  setConversations: (conversations) => set(() => ({ conversations })),

  updateMessageReactions: (reaction: ReactionDTO) =>
  set((state) => {
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

        return {
          cachedMessages: newCachedMessages,
          scrollPositions: newScrollPositions,
          cacheTimestamps: newCacheTimestamps,
        };
      }),

  addMessage: (message) =>
    set((state) => {
      const current = state.liveMessages[message.conversationId] ?? [];
      const alreadyExists = current.some((m) => m.id === message.id);
      if (alreadyExists) return state;

      return {
        liveMessages: {
          ...state.liveMessages,
          [message.conversationId]: [...current, message],
        },
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
    })),
}));
