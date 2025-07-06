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
import EmojiPicker, { EmojiClickData, Theme } from 'emoji-picker-react';

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
  replyingTo?: MessageDTO | null;
  onClearReply?: () => void;
}

export default function MessageInput({
  receiverId,
  onMessageSent,
  atBottom,
  onShowUserPopover,
  onLeaveGroup,
  userPopoverRef,
  replyingTo,
  onClearReply,
}: MessageInputProps) {
  const [text, setText] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [fileValidationError, setFileValidationError] = useState<string | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const { send, loading, error } = useSendMessage(onMessageSent);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const conversationId = useChatStore((state) => state.currentConversationId);
  const pendingLockedConversationId = useChatStore((state) => state.pendingLockedConversationId);

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
    (currentConversation?.isPendingApproval && effectiveMessageCount >= 5) ||
    isLocked;

  // Handle emoji click
  const handleEmojiClick = (emojiData: EmojiClickData) => {
    const emoji = emojiData.emoji;
    const textArea = inputRef.current;
    
    if (textArea) {
      const start = textArea.selectionStart;
      const end = textArea.selectionEnd;
      const newText = text.slice(0, start) + emoji + text.slice(end);
      setText(newText);
      
      // Restore cursor position after emoji
      setTimeout(() => {
        textArea.selectionStart = textArea.selectionEnd = start + emoji.length;
        textArea.focus();
      }, 0);
    } else {
      setText(prev => prev + emoji);
    }
    
    setShowEmojiPicker(false);
  };

  // Close emoji picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node)) {
        setShowEmojiPicker(false);
      }
    };

    if (showEmojiPicker) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showEmojiPicker]);

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
        setText(trimmed);
        inputRef.current?.focus();
      });
  };

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

  const handlePickEmoji = () => {
    setShowEmojiPicker(!showEmojiPicker);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  useEffect(() => {
    inputRef.current?.focus();
  }, [conversationId]);

  useEffect(() => {
    if (!conversationId) return;
    const existingDraft = getDraftFor(conversationId);
    setText(existingDraft);
  }, [conversationId]);

  useEffect(() => {
    if (text === "") {
      inputRef.current?.focus();
    }
  }, [text]);

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

      <MessageToolbar
        atBottom={Boolean(atBottom)}
        onScrollToBottom={scrollToBottom}
        onPickFile={handlePickFile} 
        onPickEmoji={handlePickEmoji}
        showFile={!isBlocked}
        showEmoji={!isBlocked}
        showSettings={!isBlocked}
        onShowUserPopover={onShowUserPopover}
        onLeaveGroup={onLeaveGroup}
        userPopoverRef={userPopoverRef}
      />

      {/* EmojiPicker */}
      {showEmojiPicker && (
        <div
          ref={emojiPickerRef}
          style={{
            position: 'absolute',
            bottom: '100%',
            right: '0',
            zIndex: 1000,
            marginBottom: '8px'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <EmojiPicker
            onEmojiClick={handleEmojiClick}
            width={350}
            height={400}
            previewConfig={{ showPreview: false }}
            searchDisabled={false}
            skinTonesDisabled={false}
            lazyLoadEmojis={true}
            theme={Theme.AUTO}
            style={{
              '--epr-bg-color': '#1e2122',
              '--epr-category-label-bg-color': '#334155',
              '--epr-search-input-bg-color': '#334155',
              '--epr-search-input-color': '#ffffff',
              '--epr-highlight-color': '#1C6B1C',
              '--epr-hover-bg-color': '#1C6B1C',
              '--epr-focus-bg-color': '#1C6B1C',
              '--epr-text-color': '#ffffff',
              '--epr-category-navigation-button-color': '#94a3b8',
              '--epr-category-navigation-button-color-active': '#1C6B1C',
              '--epr-category-navigation-button-color-hover': '#1C6B1C',
              border: '2px solid #1C6B1C',
              borderRadius: '12px',
            } as React.CSSProperties}
          />
        </div>
      )}

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