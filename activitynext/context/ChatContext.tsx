"use client";
//  Her har vi chat-tilstanden til ChatPage og Dropdown slik at den oppdateres seg samtidig, og som lagres i lokal storage
import { createContext, useContext, useEffect } from "react";
import { useSharedChatState } from "@/hooks/conversations/useSharedChatState";
import { useChatState } from "@/hooks/conversations/useChatState";
import { startChatSignalR } from "@/hooks/startChatSignalR";

const ChatContext = createContext<ReturnType<typeof useChatState> | null>(null);

export const ChatProvider = ({ children }: { children: React.ReactNode }) => {
  const sharedState = useSharedChatState();
  const chat = useChatState({
    ...sharedState,
    autoSelectFirstConversation: true,
  });

  // Logging
  useEffect(() => {
    console.log("✅ ChatProvider rerender med antall meldinger:", chat.messages.length);
  }, [chat.messages]);


  // 🟢 Synkroniser valgt samtale til localStorage
  useEffect(() => {
    if (chat.selectedConversationId !== sharedState.selectedConversationId) {
      sharedState.setSelectedConversationId(chat.selectedConversationId);
    }
  }, [chat.selectedConversationId, sharedState]);

  // 💬 Start SignalR-tilkobling etter chat er klar
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