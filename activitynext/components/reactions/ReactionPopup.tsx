// Her har vi popuen til emojiene samt emojilisten om hvem emojier som er lov
"use client";
import React from "react";
import styles from "./styles.module.css";

interface ReactionPopupProps {
  onSelect: (emoji: string) => void;
  onClose: () => void;
  position: { x: number; y: number };
}


console.log("👀👀👀👀👀👀👀👀 ReactionPopup vises!");

const emojis = ["👍", "❤️", "😂", "😮", "😢", "🎉", "🔥"];

export const ReactionPopup: React.FC<ReactionPopupProps> = ({ onSelect, onClose, position }) => {
  return (
    <div
       className="fixed z-[9999] bg-[#1F1F1F] text-white border border-[#1C6B1C] rounded-md shadow-lg px-2 py-1 flex gap-2"
        style={{ top: position.y, left: position.x }}
        onMouseLeave={onClose}
    >
      {emojis.map((emoji) => (
        <button key={emoji} className={styles.emojiButton} onClick={() => onSelect(emoji)}>
          {emoji}
        </button>
      ))}
    </div>
  );
};