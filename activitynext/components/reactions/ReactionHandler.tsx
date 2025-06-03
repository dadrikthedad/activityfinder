// Denne håndterer popupen og stilen og brukes for å putte en reaksjon på en melding. Brukes i MEssageList.tsx
"use client";
import { useState, useRef } from "react";
import { useReactions } from "@/hooks/reactions/useReactions";
import { ReactionPopup } from "./ReactionPopup";
import { ReactionDTO } from "@/types/MessageDTO";


interface ReactionHandlerProps {
  targetId: number;
  userId: number;
  existingReactions: ReactionDTO[];
  children: React.ReactNode;
  disabled?: boolean;
}

export const ReactionHandler: React.FC<ReactionHandlerProps> = ({ targetId, userId, existingReactions, children, disabled }) => {
  const { addReaction } = useReactions();
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const hideTimeout = useRef<NodeJS.Timeout | null>(null);


  const handleMouseEnter = (e: React.MouseEvent) => {
    if (disabled) return;
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    setPosition({ x: rect.left, y: rect.bottom }); // popup til høyre for meldingen
    if (hideTimeout.current) clearTimeout(hideTimeout.current);
    setVisible(true);
  };

  const handleMouseLeave = () => {
    hideTimeout.current = setTimeout(() => setVisible(false), 200);
  };
  
  return (
    <div onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave} className="relative inline-block">
       {children}

      {/* Meldingsinnhold */}
      {visible && !disabled && (
        <ReactionPopup
          onSelect={(emoji) => {
            addReaction({ messageId: targetId, emoji }); // toggle
            setVisible(false);
          }}
          onClose={() => setVisible(false)}
          position={position}
          userId={userId}
          existingReactions={existingReactions}
        />
      )}
    </div>
  );
};