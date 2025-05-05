"use client";

import { useEffect, useRef } from "react";

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
  onClose: () => void;
  position: { top: number; left: number };
}

const emojis = ["👍", "❤️", "😂", "🔥", "🎉", "😢", "😡", "🙌", "😍", "🤔"];

export default function EmojiPicker({ onSelect, onClose, position }: EmojiPickerProps) {
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  return (
    <div
      ref={pickerRef}
      className="absolute bg-white dark:bg-gray-800 shadow-md rounded-md p-2 flex flex-wrap gap-2 z-50"
      style={{ top: position.top, left: position.left }}
    >
      {emojis.map((emoji) => (
        <button
          key={emoji}
          className="text-2xl hover:scale-125 transition-transform"
          onClick={() => onSelect(emoji)}
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}
