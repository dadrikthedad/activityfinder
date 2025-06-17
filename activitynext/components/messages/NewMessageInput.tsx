"use client";
import { useState, useRef, useEffect } from "react";
import TextareaAutosize from "react-textarea-autosize";
import { useSendMessage } from "@/hooks/messages/useSendMessage";
import { MessageDTO } from "@/types/MessageDTO";
import MessageToolbar from "./MessageToolbar";
import { useConversationSyncOnMessage } from "@/hooks/messages/getConversationById";


interface NewMessageInputProps {
  receiverId: number;
  onMessageSent?: (message: MessageDTO) => void;
}

export default function NewMessageInput({
  receiverId,
  onMessageSent,
}: NewMessageInputProps) {
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const { send, error } = useSendMessage(onMessageSent);
  const { syncConversation } = useConversationSyncOnMessage();

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed) return;

    const sendingText = trimmed;
    setText("");
    inputRef.current?.focus();

    send({ text: sendingText, receiverId: receiverId.toString() })
      .then(async (result) => {
        if (!result) return;
        // 🚨 SJEKK isRejectedRequest FØR syncing
        if (!result.isRejectedRequest) {
          await syncConversation(result); // 👈 Henter og legger til samtalen hvis den ikke finnes. Kun sync hvis ikke avslått
        }

        onMessageSent?.(result);
      })
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  useEffect(() => {
    inputRef.current?.focus();
  }, [receiverId]);
  
    if (error) {
    return (
      <div className="flex flex-col gap-2 mt-4 h-full">
        <MessageToolbar
          showEmoji={false}
          showFile={false}
          showImage={true}
          showScrollToBottom={false}
          showSettings={false}
        />
        <div className="bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 p-4 rounded border text-center">
          <div>{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 mt-4 h-full">
      <MessageToolbar
        showEmoji={false}
        showFile={false}
        showImage={true}
        showScrollToBottom={false}
        showSettings={false}
      />

      <div className="flex gap-2 items-end">
        <TextareaAutosize
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Write a message..."
          minRows={1}
          maxRows={6}
          className="flex-1 border border-[#1C6B1C] rounded px-4 py-2 dark:bg-[#1e2122] bg-white text-sm resize-none overflow-y-auto max-h-[200px] focus:outline-none custom-scrollbar"
        />
        <button
          onClick={handleSend}
          disabled={!text.trim()}
          className="bg-[#1C6B1C] hover:bg-[#145214] text-white px-4 py-2 rounded disabled:opacity-50"
        >
          Send
        </button>
      </div>
    </div>
  );
}
