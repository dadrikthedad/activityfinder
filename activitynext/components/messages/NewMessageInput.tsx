"use client";
import { useState, useRef, useEffect } from "react";
import TextareaAutosize from "react-textarea-autosize";
import { useSendMessage } from "@/hooks/messages/useSendMessage";
import { useGroupRequests } from "@/hooks/messages/useGroupRequests";
import { MessageDTO } from "@shared/types/MessageDTO";
import { UserSummaryDTO } from "@shared/types/UserSummaryDTO";
import MessageToolbar from "./MessageToolbar";
import { SendGroupRequestsResponseDTO } from "@shared/types/SendGroupRequestsDTO";
import { useConversationUpdate } from "@/hooks/common/useConversationUpdate";
import { useApproveMessageRequest } from "@/hooks/messages/useApproveMessageRequest";
import { useEmojiInput } from "@/hooks/useEmojiPinput";
import { EmojiPickerWrapper } from "./EmojiPickerWrapper";
import { convertTextToEmojisPreserveFormat } from "../functions/message/EmojiConverter";

interface NewMessageInputProps {
  receiverId?: number;
  selectedUsers?: UserSummaryDTO[];
  groupName?: string;
  groupImageUrl?: string | null;
  shouldFocus?: boolean;
  onMessageSent?: (message: MessageDTO) => void;
  onGroupCreated?: (response: SendGroupRequestsResponseDTO) => void;
  parentOverlayId?: string; 
}

export default function NewMessageInput({
  receiverId,
  selectedUsers = [],
  groupName,
  shouldFocus = false,
  onMessageSent,
  onGroupCreated,
  groupImageUrl,
}: NewMessageInputProps) {
  const [text, setText] = useState("");
  const [rawText, setRawText] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  
  // Emoji hook
  const { showEmojiPicker, toggleEmojiPicker, closeEmojiPicker, insertEmoji } = useEmojiInput();
  
  // Hooks for both scenarios
  const { send, error: messageError } = useSendMessage(onMessageSent);
  const { sendGroupInvitations, isLoading: groupRequestLoading, error: groupRequestError, clearError: clearGroupError } = useGroupRequests();
  const { refreshConversation } = useConversationUpdate();
  const { approveLocally } = useApproveMessageRequest();

  // Determine if we're in group mode
  const isGroupMode = selectedUsers.length > 1;
  const isDisabled = isGroupMode
    ? groupRequestLoading
    : !rawText.trim() || !receiverId;

  const handleEmojiSelect = (emoji: string) => {
    insertEmoji(emoji, text, setText, inputRef as React.RefObject<HTMLTextAreaElement>);
    
    // Oppdater også rawText når emoji blir satt inn
    const currentRawText = rawText;
    const textarea = inputRef.current;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newRawText = currentRawText.substring(0, start) + emoji + currentRawText.substring(end);
      setRawText(newRawText);
    } else {
      // Fallback hvis vi ikke har cursor position
      const newRawText = currentRawText + emoji;
      setRawText(newRawText);
    }
  };

   const handleSend = async () => {
    // For 1-til-1 samtaler: krev tekst
    if (!isGroupMode) {
      const trimmed = rawText.trim(); // 🆕 Bruk rawText
      if (!trimmed) return;
      
      if (!receiverId) {
        console.error("❌ No receiverId provided for 1-to-1 message");
        return;
      }

      const sendingText = trimmed;
      setRawText(""); // 🆕 Tøm rawText
      setText(""); // 🆕 Tøm text
      inputRef.current?.focus();

      const payload = {
        text: sendingText,
        receiverId: receiverId.toString(),
      };

      console.log("📤 Sender melding med payload:", payload);

      send(payload)
        .then(async (result) => {
          if (!result) return;

          if (result.isNowApproved) {
            approveLocally(result.conversationId);
          }
          
          if (!result.isRejectedRequest) {
            await refreshConversation(result.conversationId, {
              logPrefix: "📨"
            });
          }
          onMessageSent?.(result);
        });
      
      return;
    }

    // For gruppesamtaler: tekst er optional
    try {
      const trimmed = rawText.trim(); // 🆕 Bruk rawText
      const invitedUserIds = selectedUsers.map(user => user.id);
      
      const response = await sendGroupInvitations({
        groupName: groupName?.trim() || undefined,
        invitedUserIds,
        groupImageUrl: groupImageUrl || undefined,
        initialMessage: trimmed || undefined,
      });

      if (response) {
        console.log("✅ Group created successfully:", response);
        setRawText(""); // 🆕 Tøm rawText
        setText(""); // 🆕 Tøm text
        onGroupCreated?.(response);
      }
    } catch (error) {
      console.error("❌ Failed to create group:", error);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleTextChange = (newText: string) => {
    setRawText(newText);
    setText(convertTextToEmojisPreserveFormat(newText));
  };

  useEffect(() => {
    if (shouldFocus) {
      inputRef.current?.focus();
    }
  }, [shouldFocus]);

  const currentError = messageError || groupRequestError;

  if (currentError) {
    return (
      <div className="flex flex-col gap-2 mt-4 h-full">
        <MessageToolbar
          showEmoji={false}
          showFile={false}
          showScrollToBottom={false}
          showSettings={false}
        />
        <div className="bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 p-4 rounded border text-center">
          <div>{currentError}</div>
          {groupRequestError && (
            <button 
              onClick={clearGroupError}
              className="ml-2 text-red-500 hover:text-red-700"
            >
              ✕
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 mt-4 h-full relative">
      {isGroupMode && (
        <div className="text-sm text-gray-600 dark:text-gray-400 px-2 text-center">
          Creating group with {selectedUsers.length} members
          {groupName && `: "${groupName}"`}
          {groupImageUrl && " 📷"}
        </div>
      )}

      <MessageToolbar
        showEmoji={true}
        showFile={false}
        showScrollToBottom={false}
        showSettings={false}
        onPickEmoji={toggleEmojiPicker}
      />

      {/* EmojiPicker */}
      <EmojiPickerWrapper
        isOpen={showEmojiPicker}
        onClose={closeEmojiPicker}
        onEmojiSelect={handleEmojiSelect}
        position="bottom-right"
      />

      <div className="flex gap-2 items-end">
        <TextareaAutosize
          ref={inputRef}
          value={text}
          onChange={(e) => handleTextChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isGroupMode 
            ? "Write an initial message for the group (optional)..." 
            : "Write a message..."
          }
          minRows={1}
          maxRows={6}
          className="flex-1 border border-[#1C6B1C] rounded px-4 py-2 dark:bg-[#1e2122] bg-white text-sm resize-none overflow-y-auto max-h-[200px] focus:outline-none custom-scrollbar"
        />
        <button
          onClick={handleSend}
          disabled={isDisabled}
          className="bg-[#1C6B1C] hover:bg-[#145214] text-white px-4 py-2 rounded disabled:opacity-50 min-w-[80px]"
        >
          {isGroupMode 
            ? (groupRequestLoading ? "Creating..." : "Create Group")
            : "Send"
          }
        </button>
      </div>
    </div>
  );
}