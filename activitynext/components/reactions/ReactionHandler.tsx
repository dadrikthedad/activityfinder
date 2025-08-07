"use client";

import { useState, useRef } from "react";
import { useReactions } from "@/hooks/reactions/useReactions";
import { ReactionPopup } from "./ReactionPopup";
import { ReactionDTO, MessageDTO } from "@shared/types/MessageDTO";
import { useChatStore } from "@/store/useChatStore";

interface ReactionHandlerProps {
  targetId: number;
  userId: number;
  existingReactions: ReactionDTO[];
  children: React.ReactNode;
  disabled?: boolean;
  message?: MessageDTO;
  onReply?: (message: MessageDTO) => void;
  currentUserId?: number;
  onDelete?: (message: MessageDTO) => void; // 🆕 Delete callback
}

export const ReactionHandler: React.FC<ReactionHandlerProps> = ({
  userId,
  existingReactions,
  children,
  disabled,
  message,
  onReply,
  currentUserId,
  onDelete, // 🆕 Receive delete callback
}) => {
  const { addReaction } = useReactions();
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const hideTimeout = useRef<NodeJS.Timeout | null>(null);
  const getActualMessageId = useChatStore((state) => state.getActualMessageId);

  const handleMouseEnter = (e: React.MouseEvent) => {
    if (disabled || message?.isDeleted) {
      return;
    }

    const rect = (e.target as HTMLElement).getBoundingClientRect();
    setPosition({ x: rect.left, y: rect.bottom });
    if (hideTimeout.current) clearTimeout(hideTimeout.current);
    setVisible(true);
  };

  const handleMouseLeave = () => {
    hideTimeout.current = setTimeout(() => setVisible(false), 200);
  };
  // Handler for å legge til reaksjon med riktig ID
  const handleAddReaction = (emoji: string) => {
    if (!message) {
      console.warn("⚠️ No message provided for reaction");
      return;
    }

    // 🎯 Bruk getActualMessageId for å få riktig server ID
    const actualMessageId = getActualMessageId(message);
    
    console.log(`💖 Adding reaction "${emoji}" to message:`, {
      originalId: message.id,
      actualId: actualMessageId,
      isOptimistic: message.isOptimistic,
      optimisticId: message.optimisticId
    });
  

    addReaction({ 
      messageId: actualMessageId, // 🎯 Bruk riktig server ID
      emoji 
    });
    
    setVisible(false);
  };
 
  return (
    <div onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave} className="relative inline-block">
      {children}
      {visible && !disabled && !message?.isDeleted && (
        <ReactionPopup
          onSelect={handleAddReaction} 
          onClose={() => setVisible(false)}
          position={position}
          userId={userId}
          existingReactions={existingReactions}
          message={message}
          onReply={onReply}
          currentUserId={currentUserId}
          onDelete={onDelete} // 🆕 Pass delete callback til popup
        />
      )}
    </div>
  );
};