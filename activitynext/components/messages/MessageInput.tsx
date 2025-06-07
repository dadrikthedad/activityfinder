// Inputfeltet i MessageDropdown som sender en melding over SignalR
"use client";
import { useState, useRef, useEffect } from "react";
import { useSendMessage } from "@/hooks/messages/useSendMessage";
import { MessageDTO } from "@/types/MessageDTO";
import TextareaAutosize from "react-textarea-autosize";
import { getDraftFor, saveDraftFor, clearDraftFor } from "@/utils/draft/draft";
import { useChatStore } from "@/store/useChatStore";
import MessageToolbar from "./MessageToolbar";


interface MessageInputProps {
  receiverId?: number;
  onMessageSent?: (message: MessageDTO) => void;
  atBottom?: boolean;
}

export default function MessageInput({
  receiverId,
  onMessageSent,
  atBottom
}: MessageInputProps) {
  const [text, setText] = useState("");
  const { send } = useSendMessage(onMessageSent);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const conversationId = useChatStore((state) => state.currentConversationId);
  const pendingLockedConversationId = useChatStore((state) => state.pendingLockedConversationId);

  const currentConversation = useChatStore((state) =>
    state.conversations.find((c) => c.id === conversationId)
  );


  const effectiveMessageCount = useChatStore((state) => {
    if (conversationId === null) return 0;

    const cached = state.cachedMessages[conversationId] ?? [];
    const live = state.liveMessages[conversationId] ?? [];

    // Fjern duplikater basert på melding-ID
    const uniqueLive = live.filter(
      (liveMsg) => !cached.some((c) => c.id === liveMsg.id)
    );

    return cached.length + uniqueLive.length;
  });

  const isLocked =
  conversationId !== null &&
  conversationId === pendingLockedConversationId &&
  currentConversation?.isPendingApproval !== false;

  const isBlocked = 
    (currentConversation?.isPendingApproval && effectiveMessageCount >= 5) ||
    isLocked;
  
  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed) return;

    // 1) Ta vare på teksten i en egen variabel
    const tekstSomSendes = trimmed;

    // 2) Tøm input-feltet og sett fokus umiddelbart
    setText("");
    inputRef.current?.focus();

    // 3) Kall send(...) asynkront i bakgrunnen. 
    //Hvis du vil håndtere respons (f.eks. oppdatere conversationId), gjør det i .then()/.catch().
    send({
      text: tekstSomSendes,
      conversationId: conversationId ?? undefined,
      receiverId: receiverId?.toString()
    })
      .then((result) => {
        if (!result) return;
        //–– Her kan du evt. oppdatere conversationId hvis det er ny samtale:
        if (!conversationId && result.conversationId) {
          useChatStore.getState().setCurrentConversationId(result.conversationId);
        }
        //–– Firkløver: Slett draft for samtalen:
        if (conversationId) {
          clearDraftFor(conversationId);
        }
        // (Eventuelt: sett en “sent status” på meldingen i chat-store eller vis feilmelding hvis send feiler)
      })
      .catch((err) => {
        console.error("Feil ved sending av melding:", err);
        // Du kan her vise “Kunne ikke sende”-feilmelding, 
        // eller legge meldingen tilbake i input slik at brukeren kan prøve igjen, f.eks. setText(tekstSomSendes).
        setText(tekstSomSendes);
        inputRef.current?.focus();
      });
  };
  
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

    // Autofokus ved samtalebytte
  useEffect(() => {
    inputRef.current?.focus();
  }, [conversationId]);

  useEffect(() => { // Henter en draft hver gang vi bytter samtale
  if (!conversationId) return;

  const existingDraft = getDraftFor(conversationId);
    setText(existingDraft);
  }, [conversationId]);

  // Sikrer at vi blir i tekstfeltet etter sendt melding
  useEffect(() => {
    if (text === "") {
      inputRef.current?.focus();
    }
  }, [text]);

  // Scroll til bunn ved trykk på knapp
  const scrollToBottom = () => {
    const list = document.querySelector("[data-message-scroll-container]") as HTMLElement;
    list?.scrollTo({ top: list.scrollHeight, behavior: "auto" });
  };

  return (
      <div className="flex flex-col gap-2 mt-4">
        <MessageToolbar
            atBottom={Boolean(atBottom)}
            onScrollToBottom={scrollToBottom}
            onPickImage={() => console.log("Bilde")}
            onPickFile={() => console.log("Fil")}
            onPickEmoji={() => console.log("Emoji")}
          />

      {/* Inputfelt + send-knapp */}
      <div className="flex gap-2 items-end">
        <TextareaAutosize
          ref={inputRef}
          value={text}
          onChange={(e) => {
            const newText = e.target.value;
            setText(newText);
            if (conversationId) {
              saveDraftFor(conversationId, newText);
            }
          }}
          onKeyDown={handleKeyDown}
            placeholder={
              isBlocked
                ? "You can't write any more messages until the request is accepted"
                : "Write a message..."
            }
          minRows={1}
          maxRows={6} // begrens hvor stor den kan bli
          className="flex-1 border border-[#1C6B1C] rounded px-4 py-2 dark:bg-[#1e2122] bg-white text-sm resize-none overflow-y-auto max-h-[200px] focus:outline-none custom-scrollbar"
          disabled={isBlocked}
          />
        <button
          onClick={handleSend}
          disabled={!text.trim() || isBlocked}
          className="bg-[#1C6B1C] hover:bg-[#145214] text-white px-4 py-2 rounded disabled:opacity-50"
        >
          Send
        </button>
    </div>
      </div>
  );
}