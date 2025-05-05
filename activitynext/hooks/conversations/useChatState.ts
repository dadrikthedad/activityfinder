// Her har vi all logikk rundt chatten, henter samtalelsite fra API, oppdatere meldinger ved samtalebytte, auto-velg første samtale, sende melding og oppdatering via SingalR
"use client"
import { useState, useEffect, useRef, useMemo, useCallback  } from "react";
import { useConversations } from "@/hooks/conversations/useConversations";
import { useMessagesForConversation } from "@/hooks/conversations/useMessagesForConversation";
import { useCurrentUserSummary } from "@/hooks/user/useCurrentUserSummary";
import { useSendMessage } from "@/hooks/messages/useSendMessage";
import { MessageDTO } from "@/types/MessageDTO";
import { ConversationDTO } from "@/types/ConversationDTO";
import { useMessageStore } from "./useMessageStore";


interface ChatStateProps {
    selectedConversationId: number | null;
    setSelectedConversationId: (id: number | null) => void;
    autoSelectFirstConversation?: boolean;
  }
  
  export function useChatState({
    selectedConversationId,
    setSelectedConversationId,
  }: ChatStateProps) {
    const {
        conversations: initialConvos,
        refetch, // ✅ hentes fra din hook
        loading: isLoadingConversations,
      } = useConversations();
      const {
        clearMessages,
        addMessages,
        addMessage,
        messages,
      } = useMessageStore();
    const [conversations, setConversations] = useState<ConversationDTO[]>([]);
    const { user, loading: userLoading } = useCurrentUserSummary();
    const [newMessage, setNewMessage] = useState("");
    const inputRef = useRef<HTMLTextAreaElement>(null!);
    const conversationMessages = useMessagesForConversation(selectedConversationId);
    const messagesError = conversationMessages?.error;
    const initialMessages = useMemo(() => {
        return conversationMessages?.messages ?? [];
      }, [conversationMessages?.messages]);
      const handleIncomingMessageRef = useRef<((msg: MessageDTO) => void) | null>(null);
      const isConvoReady = !isLoadingConversations;
      const hasLoadedInitialMessages = useRef(false);
      const selectedConversationIdRef = useRef<number | null>(null);
      
            



useEffect(() => {
  selectedConversationIdRef.current = selectedConversationId;
}, [selectedConversationId]);

// ref til siste samtale
const conversationsRef = useRef<ConversationDTO[]>([]);
useEffect(() => {
  conversationsRef.current = conversations;
}, [conversations]);

      
    

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
    hasLoadedInitialMessages.current = false;
  }, [selectedConversationId]);
  
  useEffect(() => {
    if (initialMessages.length > 0) {
      clearMessages();
      addMessages(initialMessages);
    }
  }, [initialMessages, clearMessages, addMessages]);


  // ✅ Auto-velg første samtale
    useEffect(() => {
      const validIds = conversations.map((c) => c.id);
      if (selectedConversationId && !validIds.includes(selectedConversationId)) {
        setSelectedConversationId(null); // 💣 ID-en tilhører ikke denne brukeren
      }
    }, [conversations, selectedConversationId, setSelectedConversationId]);


  // Send melding
  const { send, loading: sendingMessage } = useSendMessage((sentMessage) => {
    addMessage(sentMessage); // ✅ alene holder
    setNewMessage("");
    inputRef.current?.focus();
    refetch();
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
    if (!isConvoReady) {
      console.warn("⏳ initialConvos ikke klare ennå, prøver igjen om 500ms...");
      setTimeout(() => {
        handleIncomingMessageRef.current?.(incomingMessage);
      }, 500);
      return;
    }
    
  
    console.log("🧪 Sjekker incoming message vs valgt samtale", {
      incomingId: incomingMessage.conversationId,
      selectedId: selectedConversationIdRef.current,
    });
  
    // 🔍 Finn avsender fra samtale-deltakere
    const conversation = initialConvos.find(
  (c) => c.id === incomingMessage.conversationId
);

    if (!conversation || !conversation.participants) {
      console.warn("❌ Fant ikke deltagere for samtale", incomingMessage.conversationId);
    }
    
    
    const senderFromConversation = conversation?.participants?.find(
      (p) => p.id === incomingMessage.senderId
    );
    
    // Bruk alltid fallback
    const completeMessage: MessageDTO = {
      ...incomingMessage,
      sender: senderFromConversation ?? undefined,
    };

    console.log("🔍 Ser etter sender", {
  senderId: incomingMessage.senderId,
  deltagere: conversation?.participants?.map(p => ({ id: p.id, navn: p.fullName })) ?? [],
});
  
    // 💬 Legg til i meldingslisten hvis samtalen er aktiv
    if (incomingMessage.conversationId === selectedConversationIdRef.current) {
      addMessage(completeMessage);
    }
  
    // 🔄 Oppdater samtaleliste
    setConversations((prev) => {
      const index = prev.findIndex((c) => c.id === incomingMessage.conversationId);
      if (index === -1) {
        console.warn("⚠️ Fant ikke samtalen som tilhører meldingen – dropper oppdatering.");
        return prev;
      }
  
      const updated = {
        ...prev[index],
        lastMessageSentAt: new Date(incomingMessage.sentAt).toISOString(),
      };
  
      const filtered = prev.filter((c) => c.id !== incomingMessage.conversationId);
      return [updated, ...filtered].sort(
        (a, b) =>
          new Date(b.lastMessageSentAt || 0).getTime() -
          new Date(a.lastMessageSentAt || 0).getTime()
      );
    });
  
    refetch();
  }, [isConvoReady, addMessage, refetch]);

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
    handleIncomingMessage,
  };
}
