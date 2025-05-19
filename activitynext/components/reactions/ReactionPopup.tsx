// Her har vi popuen til emojiene samt emojilisten om hvem emojier som er lov
"use client";
import React from "react";
import { ReactionDTO } from "@/types/MessageDTO";
import styles from "./styles.module.css";
import { Tooltip } from "react-tooltip";

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

        return (
          <React.Fragment key={emoji}>
            <button
              className={`${styles.emojiButton} ${userHasReacted ? styles.active : ""}`}
              onClick={(e) => {
                e.stopPropagation();
                onSelect(emoji);
              }}
              data-tooltip-id={userHasReacted ? `tooltip-${emoji}` : undefined}
              data-tooltip-content={userHasReacted ? "Remove reaction" : undefined}
            >
              {emoji}
            </button>

            {userHasReacted && (
              <Tooltip
                id={`tooltip-${emoji}`}
                delayShow={250}
                place="top"
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};
