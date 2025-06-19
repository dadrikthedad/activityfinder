"use client";
import { useState, useRef, useEffect } from "react";
import TextareaAutosize from "react-textarea-autosize";
import { useSendMessage } from "@/hooks/messages/useSendMessage";
import { useGroupRequests } from "@/hooks/messages/useGroupRequests"; // ✅ Import group requests hook
import { MessageDTO } from "@/types/MessageDTO";
import { UserSummaryDTO } from "@/types/UserSummaryDTO";
import MessageToolbar from "./MessageToolbar";
import { SendGroupRequestsResponseDTO } from "@/types/SendGroupRequestsDTO";// ✅ Import response type
import { useConversationSyncOnMessage } from "@/hooks/messages/getConversationById";
import { useApproveMessageRequest } from "@/hooks/messages/useApproveMessageRequest";

interface NewMessageInputProps {
  // ✅ Support both single user and multiple users
  receiverId?: number; // Optional for group mode
  selectedUsers?: UserSummaryDTO[]; // For group mode
  groupName?: string; // Optional group name
  onMessageSent?: (message: MessageDTO) => void;
  onGroupCreated?: (response: SendGroupRequestsResponseDTO) => void; // Callback when group is created
}

export default function NewMessageInput({
  receiverId,
  selectedUsers = [],
  groupName,
  onMessageSent,
  onGroupCreated,
}: NewMessageInputProps) {
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  
  // ✅ Hooks for both scenarios
  const { send, error: messageError } = useSendMessage(onMessageSent);
  const { sendGroupInvitations, isLoading: groupRequestLoading, error: groupRequestError, clearError: clearGroupError } = useGroupRequests();
  const { syncConversation } = useConversationSyncOnMessage();

  // ✅ Determine if we're in group mode
  const isGroupMode = selectedUsers.length > 1;
  const isDisabled = isGroupMode
  ? groupRequestLoading
  : !text.trim();

  const { approveLocally } = useApproveMessageRequest();

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed) return;

    if (isGroupMode) {
      // ✅ Handle group creation
      try {
        const invitedUserIds = selectedUsers.map(user => user.id);
        
        const response = await sendGroupInvitations({
          groupName: groupName?.trim() || undefined,
          invitedUserIds,
          initialMessage: trimmed,
        });

        if (response) {
          console.log("✅ Group created successfully:", response);
          setText(""); // Clear the input
          onGroupCreated?.(response);
        }
      } catch (error) {
        console.error("❌ Failed to create group:", error);
      }
    } else {
      // ✅ Handle regular 1-to-1 message
      if (!receiverId) {
        console.error("❌ No receiverId provided for 1-to-1 message");
        return;
      }

      const sendingText = trimmed;
      setText("");
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
          
          // 🚨 SJEKK isRejectedRequest FØR syncing
          if (!result.isRejectedRequest) {
            await syncConversation(result);
          }
          onMessageSent?.(result);
        });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  useEffect(() => {
    inputRef.current?.focus();
  }, [receiverId, selectedUsers]);

  // ✅ Show error from either message sending or group creation
  const currentError = messageError || groupRequestError;

  if (currentError) {
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
    <div className="flex flex-col gap-2 mt-4 h-full">
      {/* ✅ Show group info above toolbar if in group mode */}
      {isGroupMode && (
        <div className="text-sm text-gray-600 dark:text-gray-400 px-2 text-center">
          Creating group with {selectedUsers.length} members
          {groupName && `: "${groupName}"`}
        </div>
      )}

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