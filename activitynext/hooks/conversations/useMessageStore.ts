import { create } from "zustand";
import { MessageDTO } from "@/types/MessageDTO";

interface MessageState {
  messages: MessageDTO[];
  addMessage: (msg: MessageDTO) => void;
  addMessages: (msgs: MessageDTO[]) => void;
  clearMessages: () => void;
}

export const useMessageStore = create<MessageState>((set) => ({
  messages: [],
  addMessage: (msg) =>
    set((state) => {
      if (state.messages.some((m) => m.id === msg.id)) return state;
      return { messages: [...state.messages, msg] };
    }),
  addMessages: (msgs) =>
    set(() => ({
      messages: [...msgs].sort((a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime()),
    })),
  clearMessages: () => set({ messages: [] }),
}));
