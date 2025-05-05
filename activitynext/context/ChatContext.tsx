"use client";
//  Her har vi chat-tilstanden til ChatPage og Dropdown slik at den oppdateres seg samtidig, og som lagres i lokal storage
import { createContext, useContext } from "react";
import { useChatState } from "@/hooks/conversations/useChatState";
import { useChatDropdownState } from "@/hooks/conversations/useChatDropdownState"; // ✅

const ChatContext = createContext<ReturnType<typeof useChatState> | null>(null);

export const ChatProvider = ({ children }: { children: React.ReactNode }) => {
  const dropdownState = useChatDropdownState(); // ✅ henter samtaletilstand fra localStorage
  const chat = useChatState({
    ...dropdownState,
    autoSelectFirstConversation: false,
  });

  return <ChatContext.Provider value={chat}>{children}</ChatContext.Provider>;
};

export const useChatContext = () => {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChatContext must be used inside <ChatProvider>");
  return ctx;
};
