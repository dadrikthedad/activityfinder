// Inputfeltet i MessageDropdown som sender en melding over SignalR
"use client";
import { useState, useRef, useEffect } from "react";
import { useSendMessage } from "@/hooks/messages/useSendMessage";
import { SendMessageRequestDTO, MessageDTO } from "@/types/MessageDTO";
import TextareaAutosize from "react-textarea-autosize";
import { getDraftFor, saveDraftFor, clearDraftFor } from "@/utils/draft/draft";
import { useConversationSyncOnMessage } from "@/hooks/messages/getConversationById";
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
  const { send, loading } = useSendMessage(onMessageSent);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const { syncConversation } = useConversationSyncOnMessage();
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

  const isBlocked =
  (currentConversation?.isPendingApproval && effectiveMessageCount >= 5) ||
  (conversationId !== null && conversationId === pendingLockedConversationId);
  
  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    

    const payload: SendMessageRequestDTO = {
      text: trimmed,
      conversationId: conversationId ?? undefined, 
      receiverId: receiverId?.toString()
    };

    const result = await send(payload);
    if (result) {
      setText("");
      inputRef.current?.focus();

      if (!conversationId) {
        const synced = await syncConversation(result);
        if (synced?.id) {
          useChatStore.getState().setCurrentConversationId(synced.id);
        }
      }

      if (conversationId) {
        clearDraftFor(conversationId);
      }
    }
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
          className="flex-1 border border-[#1C6B1C] rounded px-4 py-2 dark:bg-[#1e2122] bg-white text-sm resize-none overflow-y-auto max-h-[200px] focus:outline-none"
          disabled={loading || isBlocked}
          />
        <button
          onClick={handleSend}
          disabled={loading || !text.trim() || isBlocked}
          className="bg-[#1C6B1C] hover:bg-[#145214] text-white px-4 py-2 rounded disabled:opacity-50"
        >
          Send
        </button>
    </div>
      </div>
  );
}