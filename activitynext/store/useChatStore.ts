import { create } from "zustand";
import { MessageDTO } from "@/types/MessageDTO";
import { ConversationDTO } from "@/types/ConversationDTO";

type ChatStore = {
  conversations: ConversationDTO[];
  liveMessages: Record<number, MessageDTO[]>;
  setConversations: (conversations: ConversationDTO[]) => void;
  addMessage: (message: MessageDTO) => void;
  clearLiveMessages: (conversationId: number) => void;
  updateConversationTimestamp: (conversationId: number, timestamp: string) => void;
};

export const useChatStore = create<ChatStore>((set) => ({
  conversations: [],
  liveMessages: {},

  setConversations: (conversations) => set(() => ({ conversations })),

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

  clearLiveMessages: (conversationId) =>
    set((state) => {
      const copy = { ...state.liveMessages };
      delete copy[conversationId];
      return { liveMessages: copy };
    }),
}));
