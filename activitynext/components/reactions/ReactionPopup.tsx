// Her har vi popuen til emojiene samt emojilisten om hvem emojier som er lov
"use client";
import React from "react";
import { ReactionDTO } from "@/types/MessageDTO";
import styles from "./styles.module.css";
import TooltipWrapper from "../common/TooltipWrapper";

interface ReactionPopupProps {
  onSelect: (emoji: string) => void;
  onClose: () => void;
  position: { x: number; y: number };
  userId: number;
  existingReactions: ReactionDTO[];
}

console.log("👀 ReactionPopup vises!");

const emojis = ["👍", "❤️", "😂", "😮", "😢", "🎉", "🔥"];

export const ReactionPopup: React.FC<ReactionPopupProps> = ({
  onSelect,
  onClose,
  position,
  userId,
  existingReactions,
}) => {
  return (
    <div
      className={styles.popup}
      style={{ position: "fixed", top: position.y, left: position.x }}
      onMouseLeave={onClose}
    >
      {emojis.map((emoji) => {
        const userHasReacted = existingReactions.some(
          (r) => r.emoji === emoji && r.userId === userId
        );
        
        const tooltipText = userHasReacted ? "Remove reaction" : "Add reaction";
        
        return (
          <TooltipWrapper 
            key={emoji} 
            tooltip={tooltipText}
            // Her kan du legge til ekstra klasser hvis nødvendig
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