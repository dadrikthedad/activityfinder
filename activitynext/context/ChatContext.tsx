//  Her har vi chat-tilstanden til ChatPage og Dropdown slik at den oppdateres seg samtidig, og som lagres i lokal storage
"use client";

import { createContext, useContext, useEffect } from "react";
import { useLocalStorage } from "@/hooks/common/useLocalStorage";
import { useChatState } from "@/hooks/conversations/useChatState";
import { startChatSignalR } from "@/hooks/startChatSignalR";

const ChatContext = createContext<ReturnType<typeof useChatState> | null>(null);

export const ChatProvider = ({ children }: { children: React.ReactNode }) => {
  console.log("🚀 ChatProvider mountes");

useEffect(() => {
  console.log("🌀 ChatProvider rerender");
});
  const [selectedConversationId, setSelectedConversationId] = useLocalStorage<number | null>(
    "dropdown_convo",
    null
  );

  const chat = useChatState({
    selectedConversationId,
    setSelectedConversationId,
    autoSelectFirstConversation: true,
  });

  // Logging
  useEffect(() => {
    console.log("✅ ChatProvider rerender med antall meldinger:", chat.messages.length);
  }, [chat.messages]);

  // Start SignalR når chat er klar
  useEffect(() => {
    if (chat.handleIncomingMessage) {
      startChatSignalR(chat.handleIncomingMessage);
    }
  }, [chat.handleIncomingMessage]);

  return <ChatContext.Provider value={chat}>{children}</ChatContext.Provider>;
};

export const useChatContext = () => {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChatContext must be used inside <ChatProvider>");
  return ctx;
};