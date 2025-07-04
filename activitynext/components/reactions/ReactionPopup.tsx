"use client";

import React from "react";
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
  onDelete?: (message: MessageDTO) => void; // 🆕 Delete callback
}

const emojis = ["👍", "❤️", "😂", "😮", "😢", "🎉", "🔥"];

export const ReactionPopup: React.FC<ReactionPopupProps> = ({
  onSelect,
  onClose,
  position,
  userId,
  existingReactions,
  message,
  onReply,
  currentUserId,
  onDelete, // 🆕 Receive delete callback
}) => {
  // Sjekk om brukeren kan slette meldingen
  const canDelete = message && currentUserId && message.sender?.id === currentUserId && onDelete;

  const handleDelete = () => {
    if (message && onDelete) {
      onDelete(message); // 🆕 Call parent delete handler
      onClose(); // Close popup immediately
    }
  };

  return (
    <div
      className={styles.popup}
      style={{ position: "fixed", top: position.y, left: position.x }}
      onMouseLeave={onClose}
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
            <svg
              className="w-4 h-4 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"
              />
            </svg>
          </button>
        </TooltipWrapper>
      )}

      {/* Delete knapp */}
      {canDelete && (
        <TooltipWrapper tooltip="Delete message" className="inline-block">
          <button
            className={styles.deleteButton}
            onClick={(e) => {
              e.stopPropagation();
              handleDelete();
            }}
          >
            <svg
              className="w-4 h-4 text-gray-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
          </button>
        </TooltipWrapper>
      )}

      {/* Separator */}
      {(message && onReply) || canDelete ? (
        <div className={styles.separator} />
      ) : null}

      {/* Emoji knapper */}
      {emojis.map((emoji) => {
        const userHasReacted = existingReactions.some(
          (r) => r.emoji === emoji && r.userId === userId
        );
       
        const tooltipText = userHasReacted ? "Remove reaction" : "Add reaction";
       
        return (
          <TooltipWrapper
            key={emoji}
            tooltip={tooltipText}
            className="inline-block"
          >
            <button
              className={`${styles.emojiButton} ${userHasReacted ? styles.active : ""}`}
              onClick={(e) => {
                e.stopPropagation();
                onSelect(emoji);
              }}
            >
              {emoji}
            </button>
          </TooltipWrapper>
        );
      })}
    </div>
  );
};