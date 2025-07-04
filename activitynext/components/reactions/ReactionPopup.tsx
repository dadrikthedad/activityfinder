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
  // 🆕 Reply props
  message?: MessageDTO;
  onReply?: (message: MessageDTO) => void;
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
}) => {
  return (
    <div
      className={styles.popup}
      style={{ position: "fixed", top: position.y, left: position.x }}
      onMouseLeave={onClose}
    >
      {/* 🆕 Reply knapp først */}
      {message && onReply && (
        <TooltipWrapper tooltip="Reply to message" className="inline-block">
          <button
            className={styles.replyButton} // 🆕 Kun CSS module klassen
            onClick={(e) => {
              e.stopPropagation();
              onReply(message);
              onClose();
            }}
          >
            <svg
              className="w-4 h-4 text-white" // 🆕 Endret til text-white for bedre kontrast
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

      {/* Separator line mellem reply og reactions */}
      {message && onReply && (
          <div className={styles.separator} />
      )}

      {/* Existing emoji buttons */}
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