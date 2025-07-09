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
import { ReplyPreview } from "./ReplyPreview";
import { useEmojiInput } from "@/hooks/useEmojiPinput";
import { EmojiPickerWrapper } from "./EmojiPickerWrapper";
import { convertTextToEmojisPreserveFormat } from "../functions/message/EmojiConverter";


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
  userPopoverRef?: React.RefObject<HTMLDivElement | null>;
  replyingTo?: MessageDTO | null;
  onClearReply?: () => void;
  isDisabled?: boolean;
  hideToolbar?: boolean;
  conversationError?: string | null;
}

export default function MessageInput({
  receiverId,
  onMessageSent,
  atBottom,
  onShowUserPopover,
  userPopoverRef,
  replyingTo,
  onClearReply,
  isDisabled = false,
  hideToolbar = false,
  conversationError,
}: MessageInputProps) {
  const [text, setText] = useState("");
  const [rawText, setRawText] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [fileValidationError, setFileValidationError] = useState<string | null>(null);
  const { send, loading, error } = useSendMessage(onMessageSent);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const conversationId = useChatStore((state) => state.currentConversationId);
  const pendingLockedConversationId = useChatStore((state) => state.pendingLockedConversationId);

  // Bruk gjenbrukbar emoji hook
  const { showEmojiPicker, toggleEmojiPicker, closeEmojiPicker, insertEmoji } = useEmojiInput();

  const currentConversation = useChatStore((state) =>
    state.conversations.find((c) => c.id === conversationId)
  );

  const effectiveMessageCount = useChatStore((state) => {
    if (conversationId === null) return 0;

    const cached = state.cachedMessages[conversationId] ?? [];
    const live = state.liveMessages[conversationId] ?? [];

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
    isDisabled ||
    (currentConversation?.isPendingApproval && effectiveMessageCount >= 5) ||
    isLocked;

  // Gjenbrukbar emoji handler
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
      
      // Oppdater draft også
      if (conversationId) {
        saveDraftFor(conversationId, newRawText);
      }
    } else {
      // Fallback hvis vi ikke har cursor position
      const newRawText = currentRawText + emoji;
      setRawText(newRawText);
      
      if (conversationId) {
        saveDraftFor(conversationId, newRawText);
      }
    }
  };

   // Håndter tekst-endringer med emoji-konvertering
  const handleTextChange = (newText: string) => {
    setRawText(newText);
    setText(convertTextToEmojisPreserveFormat(newText));
    
    if (conversationId) {
      saveDraftFor(conversationId, newText); // Lagre rå tekst som draft
    }
  };

  // Sjekk om vi kan sende meldingen
  const canSendMessage = () => {
    const hasText = rawText.trim().length > 0;
    const hasFiles = selectedFiles.length > 0;
    const hasValidFiles = hasFiles && !fileValidationError;
    
    return (hasText || hasValidFiles) && !isBlocked && !loading;
  };

  const handleSend = () => {
    const trimmed = rawText.trim();
    const hasFiles = selectedFiles.length > 0;
    
    if (!trimmed && !hasFiles) return;
    
    if (hasFiles && fileValidationError) {
      console.error("Kan ikke sende melding med ugyldig filer:", fileValidationError);
      return;
    }

    const messageData = {
      text: trimmed || undefined,
      files: hasFiles ? selectedFiles : undefined,
      conversationId: conversationId ?? undefined,
      receiverId: receiverId?.toString(),
      parentMessageId: replyingTo?.id 
    };

    setRawText("");
    setText("");
    inputRef.current?.focus();

    send(messageData)
      .then((result) => {
        if (!result) return;
        
        setSelectedFiles([]);
        setFileValidationError(null);
        onClearReply?.();
        
        if (!conversationId && result.conversationId) {
          useChatStore.getState().setCurrentConversationId(result.conversationId);
        }
        
        if (conversationId) {
          clearDraftFor(conversationId);
        }
      })
      .catch((err) => {
        console.error("Feil ved sending av melding:", err);
        setRawText(trimmed);
        setText(convertTextToEmojisPreserveFormat(trimmed));
        inputRef.current?.focus();
      });
  };

  const displayError = conversationError || error;

   useEffect(() => {
    if (!conversationId) return;
    const existingDraft = getDraftFor(conversationId);
    setRawText(existingDraft); // 🆕 Sett rå tekst
    setText(convertTextToEmojisPreserveFormat(existingDraft)); // 🆕 Konverter og sett display tekst
  }, [conversationId]);

  useEffect(() => {
    if (rawText === "") { // 🆕 Sjekk rawText
      inputRef.current?.focus();
    }
  }, [rawText]); 

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

  const handleFileSelect = (files: File[]) => {
    const newFiles = [...selectedFiles, ...files];
    setSelectedFiles(newFiles);
    validateSelectedFiles(newFiles);
  };

  const handleRemoveFile = (index: number) => {
    const newFiles = selectedFiles.filter((_, i) => i !== index);
    setSelectedFiles(newFiles);
    validateSelectedFiles(newFiles);
  };

  const handleClearAllFiles = () => {
    setSelectedFiles([]);
    setFileValidationError(null);
  };

  const handlePickFile = () => {
    fileInputRef.current?.click();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  useEffect(() => {
    setSelectedFiles([]);
    setFileValidationError(null);
  }, [conversationId]);

  useEffect(() => {
    validateSelectedFiles(selectedFiles);
  }, []);

  const scrollToBottom = () => {
    const list = document.querySelector("[data-message-scroll-container]") as HTMLElement;
    list?.scrollTo({ top: list.scrollHeight, behavior: "auto" });
  };

  return (
    <div className="flex flex-col gap-2 mt-4 relative">
      {/* Reply preview */}
      {replyingTo && (
        <ReplyPreview 
          message={replyingTo} 
          onClear={onClearReply || (() => {})} 
        />
      )}

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
          e.target.value = '';
        }}
        className="hidden"
      />
      {!hideToolbar && (
        <MessageToolbar
          atBottom={Boolean(atBottom)}
          onScrollToBottom={scrollToBottom}
          onPickFile={handlePickFile} 
          onPickEmoji={toggleEmojiPicker}
          showFile={!isBlocked}
          showEmoji={!isBlocked}
          showSettings={!isBlocked}
          onShowUserPopover={onShowUserPopover}
          userPopoverRef={userPopoverRef}
        />
       )}

      {/* Gjenbrukbar EmojiPicker */}
      <EmojiPickerWrapper
        isOpen={showEmojiPicker}
        onClose={closeEmojiPicker}
        onEmojiSelect={handleEmojiSelect}
        position="bottom-right"
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
      {displayError  && (
        <div className="text-red-500 text-sm p-2 bg-red-50 dark:bg-red-900/20 rounded border border-red-200 dark:border-red-800">
          <div className="flex items-center gap-2">
            <span>❌</span>
            <span>{displayError}</span>
          </div>
        </div>
      )}

      {/* Inputfelt + send-knapp */}
      <div className="flex gap-2 items-end">
        <TextareaAutosize
          ref={inputRef}
          value={text}
          onChange={(e) => handleTextChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            isDisabled
              ? "This conversation has been deleted..."
              : isBlocked
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