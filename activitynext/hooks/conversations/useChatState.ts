// Her har vi all logikk rundt chatten, henter samtalelsite fra API, oppdatere meldinger ved samtalebytte, auto-velg første samtale, sende melding og oppdatering via SingalR
"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useConversations } from "@/hooks/conversations/useConversations";
import { useMessagesForConversation } from "@/hooks/conversations/useMessagesForConversation";
import { useCurrentUserSummary } from "@/hooks/user/useCurrentUserSummary";
import { useSendMessage } from "@/hooks/messages/useSendMessage";
import { MessageDTO } from "@/types/MessageDTO";
import { ConversationDTO } from "@/types/ConversationDTO";
import { useMessageStore } from "./useMessageStore";
import { conversationsRef } from "@/hooks/conversations/useChatRef";

console.trace("👀 useChatState ble initialisert");

interface ChatStateProps {
  selectedConversationId: number | null;
  setSelectedConversationId: (id: number | null) => void;
  autoSelectFirstConversation?: boolean;
}

export function useChatState({
  selectedConversationId,
  setSelectedConversationId,
}: ChatStateProps) {
  console.log("🎯 useChatState kjører nå – nytt mount");
  const { conversations: initialConvos, refetch, loading: isLoadingConversations } = useConversations();
  const { clearMessages, addMessages, addMessage, messages } = useMessageStore();
  const [conversations, setConversations] = useState<ConversationDTO[]>([]);
  const { user, loading: userLoading } = useCurrentUserSummary();
  const [newMessage, setNewMessage] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null!);
  const selectedConversationIdRef = useRef<number | null>(null);
  const conversationMessages = useMessagesForConversation(selectedConversationId);
  const initialMessages = useMemo(() => conversationMessages?.messages ?? [], [conversationMessages?.messages]);

  // Her setter vi verdien til coversationsRef.current slik at vi kan lagre hvem som er i hvem samtale for å koble avsender opp mot bilde og navn
  const setConversationsRef = useCallback((value: ConversationDTO[]) => {
    if (!Array.isArray(value)) {
      console.warn("🛑 setConversationsRef ble kalt med noe som ikke er en array!", value);
    } else if (value.length === 0) {
      console.warn("⚠️ setConversationsRef ble kalt med tom array 🧹 mulig reset!");
    }
  
    console.trace("📍 setConversationsRef trace – hvem kalte dette?");
    conversationsRef.current = value;
  }, []);

 
  // Her sorterer vi samtalene etter en melding er mottat for å ha de i riktig rekkefølge
  useEffect(() => {
    const sorted = [...initialConvos].sort((a, b) =>
      new Date(b.lastMessageSentAt || 0).getTime() -
      new Date(a.lastMessageSentAt || 0).getTime()
    );
  
    const prevString = JSON.stringify(conversations.map(c => c.id));
    const nextString = JSON.stringify(sorted.map(c => c.id));
    
    // Hvis samtalen ikke har endret seg så trenger den ikke å oppdateres (FJERNES?)
    if (prevString !== nextString) {
      setConversationsRef(sorted);
      setConversations(sorted);
      console.log("✅ Oppdaterer conversations + conversationsRef:", sorted.map(c => ({
        id: c.id,
        participants: c.participants.map(p => p.id),
      })));
    } else {
      console.log("🔁 Samme rekkefølge – hopper over update");
    }
  }, [initialConvos, setConversationsRef, conversations]);

  // Denne oppdaterer selectedConversationIdRef driekte (fjerner referansen) og trigger en rerender
  const setSelectedConversationIdWithRef = useCallback((id: number | null) => {
    console.log("📥 Setter valgt samtale via setSelectedConversationIdWithRef:", id);
    selectedConversationIdRef.current = id;
    setSelectedConversationId(id);
  }, [setSelectedConversationId]);

  // Denne bremser samtale henting. Må ha den fram til vi finner årsaken (FJERNES?)
  useEffect(() => {
    selectedConversationIdRef.current = selectedConversationId;
    console.log("🧠 Oppdaterer selectedConversationIdRef:", selectedConversationId);
  }, [selectedConversationId]);

  // Denne reseter og oppdaterer meldinger når en samtale byttes
  useEffect(() => {
    if (initialMessages.length > 0) {
      console.log("Oppdaterer meldinger når en samtale byttes.");
      clearMessages();
      addMessages(initialMessages);
    }
  }, [initialMessages, clearMessages, addMessages]);

  // Her oppdateres samtaler og setConversationsRef slik at det alltid stemmer. en Wrapper funksjon
  const safeSetConversations = useCallback(
    (updater: (prev: ConversationDTO[]) => ConversationDTO[]) => {
      setConversations(prev => {
        const next = updater(prev);
        setConversationsRef(next);
        console.log("🔄 safeSetConversations → ref oppdatert:", next.map(c => c.id));
        return next;
      });
    },
    [setConversationsRef] // bare nødvendig hvis `setConversationsRef` ikke er stabil
  );

  // Her velger vi første samtale når samtaler har blitt innlastet slik at ChatPage ikke er tom

  // 
  useEffect(() => {
    if (isLoadingConversations || conversations.length === 0) return;

    const validIds = conversations.map(c => c.id);
    if (selectedConversationId && !validIds.includes(selectedConversationId)) {
      console.warn("❌ Samtale ikke funnet, nullstiller valgt samtale.");
      setSelectedConversationId(null);
    }
  }, [isLoadingConversations, conversations, selectedConversationId, setSelectedConversationId]);

  const { send, loading: sendingMessage } = useSendMessage((sentMessage) => {
    addMessage(sentMessage);
    setNewMessage("");
    inputRef.current?.focus();
    refetch();
  });

  const handleSend = () => {
    if (userLoading || !user || !newMessage.trim() || !selectedConversationId) return;
    send({ text: newMessage.trim(), conversationId: selectedConversationId });
  };

  const handleIncomingMessage = useCallback((incomingMessage: MessageDTO, attempt = 0) => {
    console.log("🕵️ Sjekker conversationsRef.current før melding:", conversationsRef.current.map(c => ({
      id: c.id,
      participants: c.participants.map(p => p.id),
    })));

    const MAX_RETRIES = 30;

    if (!Array.isArray(conversationsRef.current)) {
      console.error("🛑 conversationsRef.current er IKKE en array!", conversationsRef.current);
    }

    const conversation = conversationsRef.current.find(c => c.id === incomingMessage.conversationId);

    if (!conversation) {
      if (attempt >= MAX_RETRIES) {
        console.error(`🛑 Avbryter etter ${MAX_RETRIES} forsøk – samtale ID ${incomingMessage.conversationId} finnes fortsatt ikke`);
        return;
      }
      console.warn(`⏳ Samtale ID ${incomingMessage.conversationId} ikke klar enda (forsøk ${attempt + 1})`);
      setTimeout(() => handleIncomingMessage(incomingMessage, attempt + 1), 200);
      return;
    }

    const hydratedSender = conversation.participants.find(p => p.id === incomingMessage.senderId);

    const completeMessage: MessageDTO = {
      ...incomingMessage,
      sender: hydratedSender ?? incomingMessage.sender ?? undefined,
    };

    if (incomingMessage.conversationId === selectedConversationIdRef.current) {
      addMessage(completeMessage);
    }

    safeSetConversations(prev => {
      const index = prev.findIndex(c => c.id === incomingMessage.conversationId);
      if (index === -1) return prev;

      const updated = { ...prev[index], lastMessageSentAt: incomingMessage.sentAt };
      const rest = prev.filter((_, i) => i !== index);
      const newList = [updated, ...rest];

      setConversationsRef(newList);
      console.log("✅ conversationsRef oppdatert direkte i setConversations:", newList.map(c => c.id));

      return newList;
    });

    refetch();
  }, [addMessage, refetch, safeSetConversations, setConversationsRef]);

  return {
    conversations,
    user,
    userLoading,
    selectedConversationId,
    setSelectedConversationId: setSelectedConversationIdWithRef,
    messages,
    messagesError: conversationMessages?.error,
    newMessage,
    setNewMessage,
    handleSend,
    sendingMessage,
    inputRef,
    handleIncomingMessage,
  };
}