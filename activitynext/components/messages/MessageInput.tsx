// Inputfeltet i MessageDropdown som sender en melding over SignalR
"use client";
import { useState, useRef, useEffect } from "react";
import { useSendMessage } from "@/hooks/messages/useSendMessage";
import { SendMessageRequestDTO, MessageDTO } from "@/types/MessageDTO";
import TextareaAutosize from "react-textarea-autosize";
import { getDraftFor, saveDraftFor, clearDraftFor } from "@/utils/draft/draft";
import { useConversationSyncOnMessage } from "@/hooks/messages/getConversationById";

interface MessageInputProps {
  conversationId?: number;
  receiverId?: number;
  onMessageSent?: (message: MessageDTO) => void;
}

export default function MessageInput({
  conversationId,
  receiverId,
  onMessageSent,
}: MessageInputProps) {
  const [text, setText] = useState("");
  const { send, loading } = useSendMessage(onMessageSent);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const { syncConversation } = useConversationSyncOnMessage();

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed) return;

    const payload: SendMessageRequestDTO = {
      text: trimmed,
      conversationId,
      receiverId: receiverId?.toString()
    };

    const result = await send(payload);
    if (result) {
      setText("");
      inputRef.current?.focus();

       if (!conversationId) {
        // 👇 Oppdater samtalelisten hvis det var en ny samtale
        await syncConversation(result);
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

  useEffect(() => { // Henter en draft hver gang vi bytter samtale
  if (!conversationId) return;

  const existingDraft = getDraftFor(conversationId);
    setText(existingDraft);
  }, [conversationId]);

  return (
    <div className="flex gap-2 items-end mt-4">
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
        placeholder="Skriv en melding..."
        minRows={1}
        maxRows={6} // begrens hvor stor den kan bli
        className="flex-1 border border-[#1C6B1C] rounded px-4 py-2 dark:bg-[#1e2122] bg-white text-sm resize-none overflow-y-auto max-h-[200px]"
        disabled={loading}
        />
      <button
        onClick={handleSend}
        disabled={loading || !text.trim()}
        className="bg-[#1C6B1C] hover:bg-[#145214] text-white px-4 py-2 rounded disabled:opacity-50"
      >
        Send
      </button>
    </div>
  );
}