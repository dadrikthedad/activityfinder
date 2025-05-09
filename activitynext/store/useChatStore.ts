// Lagerer meldinger og oppdatere meldinger som blir pushet fra layout når den oppdager SignalR
import { create } from "zustand";
import { MessageDTO } from "@/types/MessageDTO";
import { ConversationDTO } from "@/types/ConversationDTO"; 

type ChatStore = {
    messagesByConversation: Record<number, MessageDTO[]>;
    conversations: ConversationDTO[];
    conversationScrollPositions: Record<number, number>;
  
    setConversations: (conversations: ConversationDTO[]) => void;
    addMessage: (message: MessageDTO) => void;
    setScrollPosition: (conversationId: number, position: number) => void;
    getScrollPosition: (conversationId: number) => number | undefined;
    setMessagesForConversation: (conversationId: number, messages: MessageDTO[]) => void;
  };

  export const useChatStore = create<ChatStore>((set, get) => ({
    messagesByConversation: {},
    conversations: [],
    conversationScrollPositions: {},
  
    setConversations: (conversations) => set(() => ({ conversations })),
    
    setMessagesForConversation: (conversationId, messages) =>
        set((state) => ({
          messagesByConversation: {
            ...state.messagesByConversation,
            [conversationId]: messages,
          },
        })),
  
    addMessage: (message) =>
      set((state) => {
        const existing = state.messagesByConversation[message.conversationId] || [];
        const alreadyExists = existing.some((m) => m.id === message.id);
        if (alreadyExists) return state;
  
        return {
          messagesByConversation: {
            ...state.messagesByConversation,
            [message.conversationId]: [...existing, message],
          },
        };
      }),
  
    setScrollPosition: (conversationId, position) => {
      console.log(`[Store] setScrollPosition for conversation ${conversationId}: ${position}`);
      set((state) => ({
        conversationScrollPositions: {
          ...state.conversationScrollPositions,
          [conversationId]: position,
        },
      }));
    },
  
    getScrollPosition: (conversationId) => {
      const position = get().conversationScrollPositions[conversationId];
      console.log(`[Store] getScrollPosition for conversation ${conversationId}: ${position}`);
      return position;
    },
  }));
