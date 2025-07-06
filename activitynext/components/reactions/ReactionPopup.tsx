// Først installer: npm install emoji-picker-react

"use client";
import React, { useState } from "react";
import EmojiPicker, { EmojiClickData, Theme } from 'emoji-picker-react';
import { ReactionDTO, MessageDTO } from "@/types/MessageDTO";
import styles from "./styles.module.css";
import TooltipWrapper from "../common/TooltipWrapper";

interface ReactionPopupProps {
  onSelect: (emoji: string) => void;
  onClose: () => void;
  position: { x: number; y: number };
  userId: number;
  existingReactions: ReactionDTO[];
  message?: MessageDTO;
  onReply?: (message: MessageDTO) => void;
  currentUserId?: number;
  onDelete?: (message: MessageDTO) => void;
}

const quickEmojis = ["👍", "❤️", "😂", "😮", "😢", "🎉", "🔥"];

export const ReactionPopup: React.FC<ReactionPopupProps> = ({
  onSelect,
  onClose,
  position,
  userId,
  existingReactions,
  message,
  onReply,
  currentUserId,
  onDelete,
}) => {
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  
  const canDelete = message && currentUserId && message.sender?.id === currentUserId && onDelete;

  const handleDelete = () => {
    if (message && onDelete) {
      onDelete(message);
      onClose();
    }
  };

  const handleEmojiClick = (emojiData: EmojiClickData) => {
    onSelect(emojiData.emoji);
    setShowEmojiPicker(false);
    onClose();
  };

  const handleQuickEmojiSelect = (emoji: string) => {
    onSelect(emoji);
    onClose();
  };

  const handleMouseLeave = () => {
    // Ikke lukk hvis musen beveger seg til EmojiPicker
    if (showEmojiPicker) {
      return;
    }
    onClose();
  };

  return (
    <>
      <div
        className={styles.popup}
        style={{ position: "fixed", top: position.y, left: position.x }}
        onMouseLeave={handleMouseLeave}
      >
        {/* Reply knapp */}
        {message && onReply && (
          <TooltipWrapper tooltip="Reply to message" className="inline-block">
            <button
              className={styles.replyButton}
              onClick={(e) => {
                e.stopPropagation();
                onReply(message);
                onClose();
              }}
            >
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
              </svg>
            </button>
          </TooltipWrapper>
        )}

        {/* Separator */}
        {message && onReply && <div className={styles.separator} />}

        {/* Quick emoji knapper */}
        {quickEmojis.map((emoji) => {
          const userHasReacted = existingReactions.some(
            (r) => r.emoji === emoji && r.userId === userId
          );
         
          return (
            <TooltipWrapper
              key={emoji}
              tooltip={userHasReacted ? "Remove reaction" : "Add reaction"}
              className="inline-block"
            >
              <button
                className={`${styles.emojiButton} ${userHasReacted ? styles.active : ""}`}
                onClick={(e) => {
                  e.stopPropagation();
                  handleQuickEmojiSelect(emoji);
                }}
              >
                {emoji}
              </button>
            </TooltipWrapper>
          );
        })}

        {/* More emojis knapp */}
        <TooltipWrapper tooltip="More emojis" className="inline-block">
          <button
            className={styles.moreEmojisButton}
            onClick={(e) => {
              e.stopPropagation();
              setShowEmojiPicker(!showEmojiPicker);
            }}
          >
            {/* Smilefjes med tre prikker - indikerer "mer" */}
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <circle cx="5" cy="18" r="1"/>
              <circle cx="12" cy="18" r="1"/>
              <circle cx="19" cy="18" r="1"/>
            </svg>
          </button>
        </TooltipWrapper>

        {/* Separator og delete */}
        {canDelete && <div className={styles.separator} />}
        {canDelete && (
          <TooltipWrapper tooltip="Delete message" className="inline-block">
            <button className={styles.deleteButton} onClick={(e) => { e.stopPropagation(); handleDelete(); }}>
              <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </TooltipWrapper>
        )}
      </div>

      {/* Full EmojiPicker */}
      {showEmojiPicker && (
        <div
          style={{
            position: 'fixed',
            top: position.y - 450,
            left: position.x,
            zIndex: 2000
          }}
          onClick={(e) => e.stopPropagation()}
          onMouseEnter={() => {
            // Hold ReactionPopup åpen når musen er over EmojiPicker
          }}
          onMouseLeave={() => {
            // Lukk både EmojiPicker og ReactionPopup når musen forlater begge
            setShowEmojiPicker(false);
            setTimeout(() => onClose(), 100); // Liten delay for å unngå flimring
          }}
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
              '--epr-category-navigation-button-color-active': '#1C6B1C', // Aktiv kategori
              '--epr-category-navigation-button-color-hover': '#1C6B1C', // 🆕 Hover på kategori
              border: '2px solid #1C6B1C',
              borderRadius: '12px',
            } as React.CSSProperties}
          />
        </div>
      )}
      
      {/* Bakgrunn overlay for å lukke picker */}
      {showEmojiPicker && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 1999
          }}
          onClick={() => {
            setShowEmojiPicker(false);
            onClose();
          }}
        />
      )}
    </>
  );
};