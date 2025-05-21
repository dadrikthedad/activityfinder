import { create } from "zustand";
import { MessageDTO, ReactionDTO } from "@/types/MessageDTO";
import { ConversationDTO } from "@/types/ConversationDTO";
import { MessageRequestDTO } from "@/types/MessageReqeustDTO";
import { MessageNotificationDTO } from "@/types/MessageNotificationDTO";



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
  removePendingRequest: (conversationId: number) => void;
  addConversation: (conversation: ConversationDTO) => void;
  setPendingLockedConversationId: (id: number | null) => void;
  pendingLockedConversationId: number | null;
  searchResults: MessageDTO[];
  setSearchResults: (messages: MessageDTO[]) => void;
  updateSearchResultReactions: (reaction: ReactionDTO) => void;
  messageNotifications: MessageNotificationDTO[];
  setMessageNotifications: (notifications: MessageNotificationDTO[]) => void;
  addMessageNotification: (notification: MessageNotificationDTO) => void;
  unreadConversationIds: number[];
  setUnreadConversationIds: (ids: number[]) => void;
  markConversationAsReadLocally: (conversationId: number) => void;
  isAtBottom: boolean;
  setIsAtBottom: (value: boolean) => void;
  reactionsVersion: number;
  bumpReactionsVersion: () => void;
  showNewMessageButton: boolean;
  setShowNewMessageButton: (value: boolean) => void;
  upsertReactionNotification: (notification: MessageNotificationDTO) => boolean;
  scrollToMessageId: number | null;
  setScrollToMessageId: (id: number | null) => void;
};
// Lagre når endringer ble gjort for å slette cachen
export const useChatStore = create<ChatStore>((set, get) => ({
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
  messageNotifications: [],
  setMessageNotifications: (notifications) =>
    set(() => ({ messageNotifications: notifications })),

  addMessageNotification: (notification) => {
    const state = get();
    const alreadyExists = state.messageNotifications.some(n => n.id === notification.id);

    const isReaction = notification.type === "MessageReaction";
    const filtered = isReaction
      ? state.messageNotifications.filter(
          (n) => !(n.type === "MessageReaction" && n.messageId === notification.messageId)
        )
      : state.messageNotifications;

    const updated = [notification, ...filtered].slice(0, 20);
    set({ messageNotifications: updated });

    return !alreadyExists;
  },

  reactionsVersion: 0,
  bumpReactionsVersion: () => set((state) => ({ reactionsVersion: state.reactionsVersion + 1 })),
  pendingMessageRequests: [],
  pendingLockedConversationId: null,
  setPendingLockedConversationId: (id) => set({ pendingLockedConversationId: id }),
  setPendingMessageRequests: (requests) => set(() => ({
  pendingMessageRequests: requests
  })),
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
    const { messageNotifications, unreadConversationIds } = get();

    const updated = messageNotifications.map(n =>
      n.conversationId === conversationId ? { ...n, isRead: true, readAt: new Date().toISOString() } : n
    );

    set({
      messageNotifications: updated,
      unreadConversationIds: unreadConversationIds.filter(id => id !== conversationId),
    });
  },


  setCurrentConversationId: (id) => set(() => ({ currentConversationId: id })),
  

  setConversations: (conversations) =>
  set(() => ({
    conversations: [...conversations].sort(
      (a, b) =>
        new Date(b.lastMessageSentAt ?? 0).getTime() -
        new Date(a.lastMessageSentAt ?? 0).getTime()
    ),
  })),
  
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

    upsertReactionNotification: (incoming) => {
      const state = get();

      const isReaction = incoming.type === "MessageReaction";
      if (!isReaction || incoming.messageId == null) return false;

      let wasNew = true;

      const updated = state.messageNotifications.map((n) => {
        if (
          n.type === "MessageReaction" &&
          n.messageId === incoming.messageId
        ) {
          wasNew = false;

          return {
            ...n,
            ...incoming,
            id: n.id, // 👈 beholder ID for å unngå React re-mount
            createdAt: incoming.createdAt ?? n.createdAt,
          };
        }

        return n;
      });

      // Hvis ikke fantes fra før, legg til
      const finalNotifications = wasNew
        ? [incoming, ...updated].slice(0, 20)
        : updated;

      set({ messageNotifications: finalNotifications });

      return wasNew;
    },
      

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

        return {
          cachedMessages: newCachedMessages,
          scrollPositions: newScrollPositions,
          cacheTimestamps: newCacheTimestamps,
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
      messageNotifications: [],
    })),
}));
