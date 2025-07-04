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
import { validateFiles } from "../files/FileFunctions";
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
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [fileValidationError, setFileValidationError] = useState<string | null>(null);
  const { send, loading, error } = useSendMessage(onMessageSent);
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

  // Sjekk om vi kan sende meldingen
  const canSendMessage = () => {
    const hasText = text.trim().length > 0;
    const hasFiles = selectedFiles.length > 0;
    const hasValidFiles = hasFiles && !fileValidationError;
    
    return (hasText || hasValidFiles) && !isBlocked && !loading;
  };

  const handleSend = () => {
    const trimmed = text.trim();
    const hasFiles = selectedFiles.length > 0;
    
    // Må ha enten tekst eller filer
    if (!trimmed && !hasFiles) return;
    
    // Ikke send hvis det er filvalideringsfeil
    if (hasFiles && fileValidationError) {
      console.error("Kan ikke sende melding med ugyldig filer:", fileValidationError);
      return;
    }

    // 1) Ta vare på data
    const messageData = {
      text: trimmed || undefined,
      files: hasFiles ? selectedFiles : undefined,
      conversationId: conversationId ?? undefined,
      receiverId: receiverId?.toString()
    };

    // 2) Kun tøm tekst umiddelbart (behold filer til vi vet at sendingen lykkes)
    setText("");
    inputRef.current?.focus();

    // 3) Send asynkront
    send(messageData)
      .then((result) => {
        if (!result) return;
        
        // Kun tøm filer når sendingen lykkes
        setSelectedFiles([]);
        setFileValidationError(null);
        
        if (!conversationId && result.conversationId) {
          useChatStore.getState().setCurrentConversationId(result.conversationId);
        }
        
        if (conversationId) {
          clearDraftFor(conversationId);
        }
      })
      .catch((err) => {
        console.error("Feil ved sending av melding:", err);
        // Restore kun tekst on error (filer beholdes)
        setText(trimmed);
        inputRef.current?.focus();
      });
  };

  // Valider filer når de endres
  const validateSelectedFiles = (files: File[]) => {
    if (files.length === 0) {
      setFileValidationError(null);
      return;
    }

    const validation = validateFiles(files);
    if (!validation.isValid) {
      setFileValidationError(validation.error || "Ugyldig fil");
    } else {
      setFileValidationError(null);
    }
  };

  // Handle file selection med validering
  const handleFileSelect = (files: File[]) => {
    const newFiles = [...selectedFiles, ...files];
    setSelectedFiles(newFiles);
    validateSelectedFiles(newFiles);
  };

  // Remove file med re-validering
  const handleRemoveFile = (index: number) => {
    const newFiles = selectedFiles.filter((_, i) => i !== index);
    setSelectedFiles(newFiles);
    validateSelectedFiles(newFiles);
  };

  // Clear all files
  const handleClearAllFiles = () => {
    setSelectedFiles([]);
    setFileValidationError(null);
  };

  // Open file picker
  const handlePickFile = () => {
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

  // Fjerner filer ved samtalebytte
  useEffect(() => {
    setSelectedFiles([]);
    setFileValidationError(null);
  }, [conversationId]);

  // Valider filer når komponenten mounter og når selectedFiles endres
  useEffect(() => {
    validateSelectedFiles(selectedFiles);
  }, []); // Kun ved mount

  // Scroll til bunn ved trykk på knapp
  const scrollToBottom = () => {
    const list = document.querySelector("[data-message-scroll-container]") as HTMLElement;
    list?.scrollTo({ top: list.scrollHeight, behavior: "auto" });
  };

  return (
    <div className="flex flex-col gap-2 mt-4">
      {/* Hidden file input */}
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
        onPickFile={handlePickFile} 
        onPickEmoji={() => console.log("Emoji")}
        showFile={!isBlocked}
        showEmoji={!isBlocked}
        showSettings={!isBlocked}
        onShowUserPopover={onShowUserPopover}
        onLeaveGroup={onLeaveGroup}
        userPopoverRef={userPopoverRef}
      />

      {/* File preview */}
      {selectedFiles.length > 0 && (
        <FilePreview
          files={selectedFiles}
          onRemoveFile={handleRemoveFile}
          onClearAll={handleClearAllFiles}
        />
      )}

      {/* File validation error display */}
      {fileValidationError && (
        <div className="text-red-500 text-sm p-2 bg-red-50 dark:bg-red-900/20 rounded border border-red-200 dark:border-red-800">
          <div className="flex items-center gap-2">
            <span>⚠️</span>
            <span>{fileValidationError}</span>
          </div>
        </div>
      )}

      {/* Send error display */}
      {error && (
        <div className="text-red-500 text-sm p-2 bg-red-50 dark:bg-red-900/20 rounded border border-red-200 dark:border-red-800">
          <div className="flex items-center gap-2">
            <span>❌</span>
            <span>{error}</span>
          </div>
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
              : fileValidationError
              ? "Fix file issues before sending..."
              : "Write a message..."
          }
          minRows={1}
          maxRows={6}
          className="flex-1 border border-[#1C6B1C] rounded px-4 py-2 dark:bg-[#1e2122] bg-white text-sm resize-none overflow-y-auto max-h-[200px] focus:outline-none custom-scrollbar"
          disabled={isBlocked}
        />
        <button
          onClick={handleSend}
          disabled={!canSendMessage()}
          className="bg-[#1C6B1C] hover:bg-[#145214] text-white px-4 py-2 rounded disabled:opacity-50"
        >
          Send
        </button>
      </div>
    </div>
  );
}