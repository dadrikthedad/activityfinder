// Her har vi all logikk rundt chatten, henter samtalelsite fra API, oppdatere meldinger ved samtalebytte, auto-velg første samtale, sende melding og oppdatering via SingalR
"use client"
import { useState, useEffect, useRef, useMemo, useCallback  } from "react";
import { useConversations } from "@/hooks/conversations/useConversations";
import { useMessagesForConversation } from "@/hooks/conversations/useMessagesForConversation";
import { useCurrentUserSummary } from "@/hooks/user/useCurrentUserSummary";
import { useSendMessage } from "@/hooks/messages/useSendMessage";
import { useChat } from "@/hooks/useChat";
import { MessageDTO } from "@/types/MessageDTO";
import { ConversationDTO } from "@/types/ConversationDTO";


interface ChatStateProps {
    selectedConversationId: number | null;
    setSelectedConversationId: (id: number | null) => void;
    autoSelectFirstConversation?: boolean;
  }
  
  export function useChatState({
    selectedConversationId,
    setSelectedConversationId,
    autoSelectFirstConversation = true,
  }: ChatStateProps) {
    const {
        conversations: initialConvos,
        refetch, // ✅ hentes fra din hook
      } = useConversations();
    const [conversations, setConversations] = useState<ConversationDTO[]>([]);
    const { user, loading: userLoading } = useCurrentUserSummary();
    const [newMessage, setNewMessage] = useState("");
    const [messages, setMessages] = useState<MessageDTO[]>([]);
    const inputRef = useRef<HTMLTextAreaElement>(null!);
    const conversationMessages = useMessagesForConversation(selectedConversationId);
    const messagesError = conversationMessages?.error;
    const initialMessages = useMemo(() => {
        return conversationMessages?.messages ?? [];
      }, [conversationMessages?.messages]);

      
    

    // Oppdater samtalelisten fra API (f.eks. ved ny fetch)
    useEffect(() => {
        const updated = [...initialConvos].sort(
        (a, b) =>
            new Date(b.lastMessageSentAt || 0).getTime() -
            new Date(a.lastMessageSentAt || 0).getTime()
        );
        setConversations(updated);
    }, [initialConvos]);

  // 🔁 Oppdater meldinger ved samtalebytte
  useEffect(() => {
    const sorted = [...initialMessages].sort(
      (a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime()
    );
    setMessages(sorted);
  }, [initialMessages]);

  // ✅ Auto-velg første samtale
  useEffect(() => {
    if (autoSelectFirstConversation && conversations.length > 0 && selectedConversationId === null) {
      setSelectedConversationId(conversations[0].id);
    }
  }, [conversations, selectedConversationId, autoSelectFirstConversation, setSelectedConversationId]);

  // Send melding
  const { send, loading: sendingMessage } = useSendMessage((sentMessage) => {
    setMessages((prev) => [...prev, sentMessage]);
    setNewMessage("");
    inputRef.current?.focus();
    refetch(); // 🔁 henter samtalene på nytt
  });

  const handleSend = () => {
    if (userLoading || !user || !newMessage.trim() || !selectedConversationId) return;
    send({
      text: newMessage.trim(),
      conversationId: selectedConversationId,
    });
  };

  // Lytt til nye meldinger via SignalR
  const handleIncomingMessage = useCallback((incomingMessage: MessageDTO) => {
    if (incomingMessage.conversationId === selectedConversationId) {
      setMessages((prev) => [...prev, incomingMessage]);
    }
  
    setConversations((prev) => {
      const index = prev.findIndex((c) => c.id === incomingMessage.conversationId);
      const updatedConvo =
        index !== -1
          ? {
              ...prev[index],
              lastMessageSentAt: new Date(incomingMessage.sentAt).toISOString(),
            }
          : {
              id: incomingMessage.conversationId,
              participants: [],
              isGroup: false,
              lastMessageSentAt: incomingMessage.sentAt,
            };
  
      const filtered = prev.filter((c) => c.id !== incomingMessage.conversationId);
      return [updatedConvo, ...filtered].sort(
        (a, b) =>
          new Date(b.lastMessageSentAt || 0).getTime() -
          new Date(a.lastMessageSentAt || 0).getTime()
      );
    });
  
    refetch();
  }, [selectedConversationId, refetch]);

  useChat(handleIncomingMessage);


  return {
    conversations,
    user,
    userLoading,
    selectedConversationId,
    setSelectedConversationId,
    messages,
    messagesError,
    newMessage,
    setNewMessage,
    handleSend,
    sendingMessage,
    inputRef,
  };
}
