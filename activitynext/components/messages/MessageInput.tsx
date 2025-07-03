// Inputfeltet i MessageDropdown som sender en melding over SignalR
"use client";
import { useState, useRef, useEffect } from "react";
import { useSendMessage } from "@/hooks/messages/useSendMessage";
import { MessageDTO } from "@/types/MessageDTO";
import TextareaAutosize from "react-textarea-autosize";
import { getDraftFor, saveDraftFor, clearDraftFor } from "@/utils/draft/draft";
import { useChatStore } from "@/store/useChatStore";
import MessageToolbar from "./MessageToolbar";
import { UserSummaryDTO } from "@/types/UserSummaryDTO";
import { validateFiles } from "@/components/files/PreviewHelperFunctions";
import { FilePreview } from "../files/ImagePreview";


interface MessageInputProps {
  receiverId?: number;
  onMessageSent?: (message: MessageDTO) => void;
  atBottom?: boolean;
   onShowUserPopover: (
    user: UserSummaryDTO, 
    pos: { x: number; y: number },
    groupData?: {
      isGroup: boolean;
      participants: UserSummaryDTO[];
      onLeaveGroup?: () => void;
      isPendingRequest?: boolean;
      conversationId?: number;
    }
  ) => void;
  onLeaveGroup: (conversationId: number) => Promise<void>;
  userPopoverRef?: React.RefObject<HTMLDivElement | null>;
}

export default function MessageInput({
  receiverId,
  onMessageSent,
  atBottom,
  onShowUserPopover,
  onLeaveGroup,
  userPopoverRef,
}: MessageInputProps) {
  const [text, setText] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]); // File state
  const { send, loading, error } = useSendMessage(onMessageSent); // Destructure loading & error
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
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
    const hasFiles = selectedFiles.length > 0;
    
    // Må ha enten tekst eller filer
    if (!trimmed && !hasFiles) return;

    // 1) Ta vare på data
    const messageData = {
      text: trimmed || undefined,
      files: hasFiles ? selectedFiles : undefined,
      conversationId: conversationId ?? undefined,
      receiverId: receiverId?.toString()
    };

    // 2) Tøm input-feltet og filer umiddelbart
    setText("");
    setSelectedFiles([]);
    inputRef.current?.focus();

    // 3) Send asynkront
    send(messageData)
      .then((result) => {
        if (!result) return;
        
        if (!conversationId && result.conversationId) {
          useChatStore.getState().setCurrentConversationId(result.conversationId);
        }
        
        if (conversationId) {
          clearDraftFor(conversationId);
        }
      })
      .catch((err) => {
        console.error("Feil ved sending av melding:", err);
        // Restore data on error
        setText(trimmed);
        setSelectedFiles(messageData.files || []);
        inputRef.current?.focus();
      });
  };

   // Handle file selection
  const handleFileSelect = (files: File[]) => {
    // Validate before adding
    const validation = validateFiles(files);
    if (!validation.isValid) {
      console.error("File validation failed:", validation.error);
      return;
    }
    
    setSelectedFiles(prev => [...prev, ...files]);
  };

  // Remove file
  const handleRemoveFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  // Open file picker
  const handlePickFile = () => {
    fileInputRef.current?.click();
  };

  // Open image picker (same as file picker for now)
  const handlePickImage = () => {
    fileInputRef.current?.click();
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

  // Fjerner filer ve samtalebytte
  useEffect(() => {
    setSelectedFiles([]);
  }, [conversationId]);

  // Scroll til bunn ved trykk på knapp
  const scrollToBottom = () => {
    const list = document.querySelector("[data-message-scroll-container]") as HTMLElement;
    list?.scrollTo({ top: list.scrollHeight, behavior: "auto" });
  };


  return (
      <div className="flex flex-col gap-2 mt-4">
        {/* 🆕 Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,video/*,.pdf,.doc,.docx,.txt"
          onChange={(e) => {
            const files = Array.from(e.target.files || []);
            if (files.length > 0) {
              handleFileSelect(files);
            }
            e.target.value = ''; // Reset input
          }}
          className="hidden"
        />

        <MessageToolbar
          atBottom={Boolean(atBottom)}
          onScrollToBottom={scrollToBottom}
          onPickImage={handlePickImage} // 🆕 Use new handler
          onPickFile={handlePickFile} 
          onPickEmoji={() => console.log("Emoji")}
          showFile={!isBlocked}
          showEmoji={!isBlocked}
          showSettings={!isBlocked}
          onShowUserPopover={onShowUserPopover}
          onLeaveGroup={onLeaveGroup}
          userPopoverRef={userPopoverRef}
        />

        {/* 🆕 File preview */}
        {selectedFiles.length > 0 && (
          <FilePreview
            files={selectedFiles}
            onRemoveFile={handleRemoveFile}
            onClearAll={() => setSelectedFiles([])}
          />
        )}

        {/* 🆕 Error display */}
        {error && (
          <div className="text-red-500 text-sm p-2 bg-red-50 dark:bg-red-900/20 rounded border border-red-200 dark:border-red-800">
            {error}
          </div>
        )}

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
                ? "You can't send messages until the request is accepted..."
                : "Write a message..."
            }
          minRows={1}
          maxRows={6} // begrens hvor stor den kan bli
          className="flex-1 border border-[#1C6B1C] rounded px-4 py-2 dark:bg-[#1e2122] bg-white text-sm resize-none overflow-y-auto max-h-[200px] focus:outline-none custom-scrollbar"
          disabled={isBlocked}
          />
        <button
          onClick={handleSend}
          disabled={(!text.trim() && selectedFiles.length === 0) || isBlocked || loading}
          className="bg-[#1C6B1C] hover:bg-[#145214] text-white px-4 py-2 rounded disabled:opacity-50"
        >
          Send
        </button>
    </div>
      </div>
  );
}