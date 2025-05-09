"use client";
import { useState, useRef } from "react";
import { useReactions } from "@/hooks/reactions/useReactions";
import { ReactionPopup } from "./ReactionPopup";

interface ReactionHandlerProps {
  targetId: number;
  children: React.ReactNode;
}

export const ReactionHandler: React.FC<ReactionHandlerProps> = ({ targetId, children }) => {
  const { addReaction } = useReactions();
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const hideTimeout = useRef<NodeJS.Timeout | null>(null);

  const handleMouseEnter = (e: React.MouseEvent) => {
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    setPosition({ x: rect.left, y: rect.bottom }); // popup til høyre for meldingen
    if (hideTimeout.current) clearTimeout(hideTimeout.current);
    setVisible(true);
  };

  const handleMouseLeave = () => {
    hideTimeout.current = setTimeout(() => setVisible(false), 200);
  };

  const handleSelect = (emoji: string) => {
    addReaction({ messageId: targetId, emoji });
    setVisible(false);
  };

  return (
    <div onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave} className="relative inline-block">
      {children}

      {visible && (
        <ReactionPopup
          onSelect={handleSelect}
          onClose={() => setVisible(false)}
          position={position}
        />
      )}
    </div>
  );
};