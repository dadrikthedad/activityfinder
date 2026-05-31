import { create } from "zustand";
import { persist, subscribeWithSelector, createJSONStorage } from "zustand/middleware";
import { asyncStorage } from "./indexedNotificationDBStorage";
import { MessageDTO, ReactionDTO } from "@shared/types/MessageDTO";

type ScrollData = {
  messageId: number;
  messageIndex?: number;
  offset: number;
  timestamp: number;
};

type ChatStore = {
  // Meldinger
  liveMessages: Record<number, MessageDTO[]>;
  cachedMessages: Record<number, MessageDTO[]>;
  cacheTimestamps: Record<number, number>;

  // Navigasjon
  currentConversationId: number | null;
  setCurrentConversationId: (id: number | null) => void;
  openConversation: (conversationId: number) => void;

  // Meldings-actions
  addMessage: (message: MessageDTO) => void;
  addMessageOptimistic: (message: MessageDTO) => void;
  updateMessage: (conversationId: number, messageId: number, updatedMessage: MessageDTO) => void;
  updateMessageOptimistic: (conversationId: number, optimisticId: string, updatedMessage: MessageDTO) => void;
  softDeleteMessage: (conversationId: number, messageId: number) => void;
  updateMessageReactions: (reaction: ReactionDTO) => void;
  setCachedMessages: (conversationId: number, messages: MessageDTO[]) => void;
  clearLiveMessages: (conversationId: number) => void;
  clearConversationCache: (conversationId: number) => void;

  // Scroll
  scrollPositions: Record<number, number>;
  setScrollPosition: (conversationId: number, position: number) => void;
  scrollMessageIds: Record<number, ScrollData>;
  setScrollMessageId: (conversationId: number, scrollData: ScrollData) => void;
  scrollToMessageId: number | null;
  setScrollToMessageId: (id: number | null) => void;

  // Søk
  searchMode: boolean;
  setSearchMode: (value: boolean) => void;
  searchResults: MessageDTO[];
  setSearchResults: (messages: MessageDTO[]) => void;
  updateSearchResultReactions: (reaction: ReactionDTO) => void;

  // UI
  isAtBottom: boolean;
  setIsAtBottom: (value: boolean) => void;
  showNewMessageButton: boolean;
  setShowNewMessageButton: (value: boolean) => void;
  showMessages: boolean;
  setShowMessages: (value: boolean) => void;
  reactionsVersion: number;
  bumpReactionsVersion: () => void;

  // Optimistisk mapping
  optimisticToServerIdMap: Record<string, number>;
  optimisticToServerAttachmentMap: Record<string, string>;
  registerOptimisticMapping: (optimisticId: string, serverId: number) => void;
  registerOptimisticAttachmentMapping: (optimisticAttachmentId: string, serverFileUrl: string) => void;
  getActualMessageId: (message: MessageDTO) => number | null;
  convertOptimisticToReal: (conversationId: number) => void;
  convertAllOptimisticToReal: () => void;
  cleanupOptimisticMappings: () => void;
  cleanupOptimisticForConversation: (conversationId: number) => void;
  updateAttachmentUploadStatus: (
    conversationId: number,
    messageId: number,
    attachmentOptimisticId: string,
    status: { isUploading?: boolean; uploadError?: string }
  ) => void;

  // Nylige emojier
  recentEmojis: string[];
  addRecentEmoji: (emoji: string) => void;

  // Cache cleanup
  cleanupOldCache: () => void;

  /** Tøm alt ved logout */
  reset: () => void;
};

export const useChatStore = create<ChatStore>()(
  persist(
    subscribeWithSelector((set, get) => ({
      liveMessages: {},
      cachedMessages: {},
      cacheTimestamps: {},

      currentConversationId: null,
      scrollPositions: {},
      scrollMessageIds: {},
      scrollToMessageId: null,
      searchMode: false,
      searchResults: [],
      isAtBottom: true,
      showNewMessageButton: false,
      showMessages: false,
      reactionsVersion: 0,
      optimisticToServerIdMap: {},
      optimisticToServerAttachmentMap: {},
      recentEmojis: [],

      setCurrentConversationId: (id) => set({ currentConversationId: id }),

      openConversation: (conversationId) => set({ currentConversationId: conversationId }),

      setScrollToMessageId: (id) => set({ scrollToMessageId: id }),
      setShowNewMessageButton: (value) => set({ showNewMessageButton: value }),
      setIsAtBottom: (value) => set({ isAtBottom: value }),
      setSearchMode: (value) => set({ searchMode: value }),
      setSearchResults: (messages) => set({ searchResults: messages }),
      bumpReactionsVersion: () => set((state) => ({ reactionsVersion: state.reactionsVersion + 1 })),
      setShowMessages: (value) => set({ showMessages: value }),

      setCachedMessages: (conversationId, messages) =>
        set((state) => ({
          cachedMessages: { ...state.cachedMessages, [conversationId]: messages },
          cacheTimestamps: { ...state.cacheTimestamps, [conversationId]: Date.now() },
        })),

      setScrollPosition: (conversationId, position) =>
        set((state) => ({
          scrollPositions: { ...state.scrollPositions, [conversationId]: position },
        })),

      setScrollMessageId: (conversationId, scrollData) =>
        set((state) => ({
          scrollMessageIds: { ...state.scrollMessageIds, [conversationId]: scrollData },
        })),

      clearLiveMessages: (conversationId) =>
        set((state) => {
          const copy = { ...state.liveMessages };
          delete copy[conversationId];
          return { liveMessages: copy };
        }),

      clearConversationCache: (conversationId) =>
        set((state) => ({
          cachedMessages: Object.fromEntries(
            Object.entries(state.cachedMessages).filter(([id]) => +id !== conversationId)
          ),
          liveMessages: Object.fromEntries(
            Object.entries(state.liveMessages).filter(([id]) => +id !== conversationId)
          ),
          scrollPositions: Object.fromEntries(
            Object.entries(state.scrollPositions).filter(([id]) => +id !== conversationId)
          ),
          cacheTimestamps: Object.fromEntries(
            Object.entries(state.cacheTimestamps).filter(([id]) => +id !== conversationId)
          ),
          scrollMessageIds: Object.fromEntries(
            Object.entries(state.scrollMessageIds).filter(([id]) => +id !== conversationId)
          ),
        })),

      updateSearchResultReactions: (reaction) =>
        set((state) => ({
          searchResults: state.searchResults.map((m) => {
            if (m.id !== reaction.messageId) return m;
            const filtered = (m.reactions ?? []).filter((r) => r.userId !== reaction.userId);
            if (!reaction.isRemoved) filtered.push(reaction);
            return { ...m, reactions: filtered };
          }),
        })),

      updateMessage: (conversationId, messageId, updatedMessage) =>
        set((state) => {
          const updateMessages = (messages: MessageDTO[]) =>
            messages.map((m) => (m.id === messageId ? updatedMessage : m));

          const liveMessages = { ...state.liveMessages };
          const cachedMessages = { ...state.cachedMessages };

          if (liveMessages[conversationId]?.some((m) => m.id === messageId)) {
            liveMessages[conversationId] = updateMessages(liveMessages[conversationId]);
          }
          if (cachedMessages[conversationId]?.some((m) => m.id === messageId)) {
            cachedMessages[conversationId] = updateMessages(cachedMessages[conversationId]);
          }

          return { liveMessages, cachedMessages };
        }),

      updateMessageOptimistic: (conversationId, optimisticId, updatedMessage) =>
        set((state) => {
          const updateMessages = (messages: MessageDTO[]) =>
            messages.map((m) => (m.optimisticId === optimisticId ? updatedMessage : m));

          const liveMessages = { ...state.liveMessages };
          const cachedMessages = { ...state.cachedMessages };

          if (liveMessages[conversationId]?.some((m) => m.optimisticId === optimisticId)) {
            liveMessages[conversationId] = updateMessages(liveMessages[conversationId]);
          }
          if (cachedMessages[conversationId]?.some((m) => m.optimisticId === optimisticId)) {
            cachedMessages[conversationId] = updateMessages(cachedMessages[conversationId]);
          }

          return { liveMessages, cachedMessages };
        }),

      softDeleteMessage: (conversationId, messageId) =>
        set((state) => {
          const markDeleted = (messages: MessageDTO[]) =>
            messages.map((m) =>
              m.id === messageId ? { ...m, isDeleted: true, attachments: [] } : m
            );

          const liveMessages = { ...state.liveMessages };
          const cachedMessages = { ...state.cachedMessages };

          if (liveMessages[conversationId]?.some((m) => m.id === messageId)) {
            liveMessages[conversationId] = markDeleted(liveMessages[conversationId]);
          }
          if (cachedMessages[conversationId]?.some((m) => m.id === messageId)) {
            cachedMessages[conversationId] = markDeleted(cachedMessages[conversationId]);
          }

          return { liveMessages, cachedMessages };
        }),

      updateMessageReactions: (reaction) =>
        set((state) => {
          if (!reaction.messageId) return state;

          const updateMessages = (messages: MessageDTO[]) =>
            messages.map((m) => {
              const isDirectMatch = m.id === reaction.messageId;
              const isOptimisticMatch =
                m.isOptimistic &&
                state.optimisticToServerIdMap[m.optimisticId || ""] === reaction.messageId;

              if (!isDirectMatch && !isOptimisticMatch) return m;

              const filtered = (m.reactions ?? []).filter((r) => r.userId !== reaction.userId);
              if (!reaction.isRemoved) filtered.push(reaction);
              return { ...m, reactions: filtered };
            });

          const liveMessages = { ...state.liveMessages };
          const cachedMessages = { ...state.cachedMessages };

          for (const [convId, msgs] of Object.entries(state.liveMessages)) {
            const hasTarget = msgs.some(
              (m) =>
                m.id === reaction.messageId ||
                (m.isOptimistic &&
                  state.optimisticToServerIdMap[m.optimisticId || ""] === reaction.messageId)
            );
            if (hasTarget) liveMessages[+convId] = updateMessages(msgs);
          }

          for (const [convId, msgs] of Object.entries(state.cachedMessages)) {
            const hasTarget = msgs.some(
              (m) =>
                m.id === reaction.messageId ||
                (m.isOptimistic &&
                  state.optimisticToServerIdMap[m.optimisticId || ""] === reaction.messageId)
            );
            if (hasTarget) cachedMessages[+convId] = updateMessages(msgs);
          }

          return { liveMessages, cachedMessages, reactionsVersion: state.reactionsVersion + 1 };
        }),

      addMessage: (message) =>
        set((state) => {
          const current = state.liveMessages[message.conversationId] ?? [];

          if (message.isOptimistic) {
            if (current.some((m) => m.id === message.id)) return state;
            return {
              liveMessages: {
                ...state.liveMessages,
                [message.conversationId]: [...current, message],
              },
            };
          }

          const optimisticMatch = current.find(
            (m) =>
              m.isOptimistic &&
              m.text === message.text &&
              m.senderId === message.senderId &&
              Math.abs(
                new Date(m.sentAt).getTime() - new Date(message.sentAt).getTime()
              ) < 10000
          );

          if (optimisticMatch) return state;
          if (current.some((m) => m.id === message.id)) return state;

          return {
            liveMessages: {
              ...state.liveMessages,
              [message.conversationId]: [...current, message],
            },
          };
        }),

      addMessageOptimistic: (message) =>
        set((state) => {
          const current = state.liveMessages[message.conversationId] ?? [];
          const alreadyExists = current.some(
            (m) =>
              m.optimisticId === message.optimisticId ||
              (message.id && m.id === message.id)
          );
          if (alreadyExists) return state;
          return {
            liveMessages: {
              ...state.liveMessages,
              [message.conversationId]: [...current, message],
            },
          };
        }),

      registerOptimisticMapping: (optimisticId, serverId) =>
        set((state) => ({
          optimisticToServerIdMap: { ...state.optimisticToServerIdMap, [optimisticId]: serverId },
        })),

      registerOptimisticAttachmentMapping: (optimisticAttachmentId, serverFileUrl) =>
        set((state) => ({
          optimisticToServerAttachmentMap: {
            ...state.optimisticToServerAttachmentMap,
            [optimisticAttachmentId]: serverFileUrl,
          },
        })),

      getActualMessageId: (message) => {
        const state = get();
        if (message.isOptimistic && message.optimisticId) {
          return state.optimisticToServerIdMap[message.optimisticId] ?? null;
        }
        return message.id;
      },

      convertOptimisticToReal: (conversationId) =>
        set((state) => {
          const convertMessages = (messages: MessageDTO[]) =>
            messages.map((m) => {
              if (!m.isOptimistic || !m.optimisticId) return m;
              const serverId = state.optimisticToServerIdMap[m.optimisticId];
              if (!serverId) return m;

              const converted: MessageDTO = {
                ...m,
                id: serverId,
                isOptimistic: false,
                optimisticId: undefined,
                isSending: false,
                sendError: null,
              };

              if (converted.attachments?.length) {
                converted.attachments = converted.attachments.map((att) => {
                  if (!att.isOptimistic || !att.optimisticId) return att;
                  const serverUrl = state.optimisticToServerAttachmentMap[att.optimisticId];
                  if (!serverUrl) return att;
                  return {
                    ...att,
                    fileUrl: serverUrl,
                    isOptimistic: false,
                    optimisticId: undefined,
                    isUploading: false,
                    uploadError: null,
                    localUri: undefined,
                  };
                });
              }

              return converted;
            });

          return {
            liveMessages: {
              ...state.liveMessages,
              [conversationId]: convertMessages(state.liveMessages[conversationId] || []),
            },
            cachedMessages: {
              ...state.cachedMessages,
              [conversationId]: convertMessages(state.cachedMessages[conversationId] || []),
            },
          };
        }),

      convertAllOptimisticToReal: () =>
        set((state) => {
          const newLive: Record<number, MessageDTO[]> = {};
          for (const [convId, messages] of Object.entries(state.liveMessages)) {
            newLive[+convId] = messages.map((m) => {
              if (!m.isOptimistic || !m.optimisticId) return m;
              const serverId = state.optimisticToServerIdMap[m.optimisticId];
              if (!serverId) return m;
              let converted: MessageDTO = {
                ...m,
                id: serverId,
                isOptimistic: false,
                isSending: false,
                sendError: null,
              };
              if (converted.attachments?.length) {
                converted.attachments = converted.attachments.map((att) => {
                  if (!att.isOptimistic || !att.optimisticId) return att;
                  const serverUrl = state.optimisticToServerAttachmentMap[att.optimisticId];
                  if (!serverUrl) return att;
                  return {
                    ...att,
                    fileUrl: serverUrl,
                    isOptimistic: false,
                    isUploading: false,
                    uploadError: null,
                  };
                });
              }
              return converted;
            });
          }
          return { liveMessages: newLive };
        }),

      cleanupOptimisticMappings: () =>
        set((state) => {
          const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
          const filterByTimestamp = <V>(map: Record<string, V>) =>
            Object.fromEntries(
              Object.entries(map).filter(([id]) => {
                const ts = parseInt(id.split("_")[1]);
                return !ts || ts > twoHoursAgo;
              })
            );
          return {
            optimisticToServerIdMap: filterByTimestamp(state.optimisticToServerIdMap),
            optimisticToServerAttachmentMap: filterByTimestamp(
              state.optimisticToServerAttachmentMap
            ),
          };
        }),

      cleanupOptimisticForConversation: (conversationId) =>
        set((state) => {
          const allMsgs = [
            ...(state.liveMessages[conversationId] || []),
            ...(state.cachedMessages[conversationId] || []),
          ];
          const msgOptIds = new Set(
            allMsgs
              .filter((m) => m.isOptimistic && m.optimisticId)
              .map((m) => m.optimisticId!)
          );
          const attOptIds = new Set(
            allMsgs
              .flatMap((m) => m.attachments || [])
              .filter((a) => a.isOptimistic && a.optimisticId)
              .map((a) => a.optimisticId!)
          );

          const cleanedMsgMap = { ...state.optimisticToServerIdMap };
          const cleanedAttMap = { ...state.optimisticToServerAttachmentMap };
          msgOptIds.forEach((id) => delete cleanedMsgMap[id]);
          attOptIds.forEach((id) => delete cleanedAttMap[id]);

          return {
            optimisticToServerIdMap: cleanedMsgMap,
            optimisticToServerAttachmentMap: cleanedAttMap,
          };
        }),

      updateAttachmentUploadStatus: (conversationId, messageId, attachmentOptimisticId, status) =>
        set((state) => {
          const updateAttachments = (messages: MessageDTO[]) =>
            messages.map((msg) => {
              if (msg.id !== messageId) return msg;
              return {
                ...msg,
                attachments: msg.attachments.map((att) =>
                  att.isOptimistic && att.optimisticId === attachmentOptimisticId
                    ? { ...att, ...status }
                    : att
                ),
              };
            });

          return {
            cachedMessages: {
              ...state.cachedMessages,
              [conversationId]: updateAttachments(state.cachedMessages[conversationId] || []),
            },
            liveMessages: {
              ...state.liveMessages,
              [conversationId]: updateAttachments(state.liveMessages[conversationId] || []),
            },
          };
        }),

      addRecentEmoji: (emoji) =>
        set((state) => {
          const filtered = state.recentEmojis.filter((e) => e !== emoji);
          return { recentEmojis: [emoji, ...filtered].slice(0, 10) };
        }),

      cleanupOldCache: () =>
        set((state) => {
          const now = Date.now();
          const TTL = 1000 * 60 * 10;
          const currentId = state.currentConversationId;

          const newCached: typeof state.cachedMessages = {};
          const newScrollPositions: typeof state.scrollPositions = {};
          const newTimestamps: typeof state.cacheTimestamps = {};

          for (const id in state.cacheTimestamps) {
            const convId = +id;
            if (convId === currentId || now - state.cacheTimestamps[convId] < TTL) {
              newCached[convId] = state.cachedMessages[convId];
              newScrollPositions[convId] = state.scrollPositions[convId];
              newTimestamps[convId] = state.cacheTimestamps[convId];
            }
          }

          return {
            cachedMessages: newCached,
            scrollPositions: newScrollPositions,
            cacheTimestamps: newTimestamps,
          };
        }),

      reset: () =>
        set({
          liveMessages: {},
          cachedMessages: {},
          cacheTimestamps: {},
          currentConversationId: null,
          scrollPositions: {},
          scrollMessageIds: {},
          scrollToMessageId: null,
          searchMode: false,
          searchResults: [],
          isAtBottom: true,
          showNewMessageButton: false,
          showMessages: false,
          reactionsVersion: 0,
          optimisticToServerIdMap: {},
          optimisticToServerAttachmentMap: {},
          recentEmojis: [],
        }),
    })),
    {
      name: "chat-cache",
      storage: createJSONStorage(() => asyncStorage),

      partialize: (state) => {
        const limitedCached: Record<number, MessageDTO[]> = {};
        for (const [id, msgs] of Object.entries(state.cachedMessages)) {
          limitedCached[+id] = msgs.slice(-100);
        }
        const limitedLive: Record<number, MessageDTO[]> = {};
        for (const [id, msgs] of Object.entries(state.liveMessages)) {
          limitedLive[+id] = msgs.slice(-50);
        }
        return {
          cachedMessages: limitedCached,
          liveMessages: limitedLive,
          scrollPositions: state.scrollPositions,
          cacheTimestamps: state.cacheTimestamps,
          scrollMessageIds: state.scrollMessageIds,
          optimisticToServerIdMap: state.optimisticToServerIdMap || {},
          optimisticToServerAttachmentMap: state.optimisticToServerAttachmentMap || {},
          recentEmojis: state.recentEmojis,
        };
      },

      onRehydrateStorage: () => (state) => {
        if (state) {
          if (!state.optimisticToServerIdMap) state.optimisticToServerIdMap = {};
          if (!state.optimisticToServerAttachmentMap) state.optimisticToServerAttachmentMap = {};
        }
      },

      version: 2,
      migrate: () => ({
        liveMessages: {},
        cachedMessages: {},
        cacheTimestamps: {},
        currentConversationId: null,
        scrollPositions: {},
        scrollMessageIds: {},
        scrollToMessageId: null,
        searchMode: false,
        searchResults: [],
        isAtBottom: true,
        showNewMessageButton: false,
        showMessages: false,
        reactionsVersion: 0,
        optimisticToServerIdMap: {},
        optimisticToServerAttachmentMap: {},
        recentEmojis: [],
      }),
    }
  )
);
