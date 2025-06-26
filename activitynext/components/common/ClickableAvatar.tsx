// components/common/ClickableAvatar.tsx
"use client";
import React from "react";
import MiniAvatar from "./MiniAvatar";
import { UserSummaryDTO } from "@/types/UserSummaryDTO";
import { useUserActionPopoverStore } from "@/store/useUserActionPopoverStore";
import { calculatePopoverPosition } from "./PopoverPositioning";

interface ClickableAvatarProps {
  user: UserSummaryDTO;
  size?: number;
  className?: string;
  isGroup?: boolean;
  participants?: UserSummaryDTO[];
  onLeaveGroup?: () => void;
  conversationId?: number;
  isPendingRequest?: boolean;
}

export default function ClickableAvatar({
  user,
  size = 60,
  className = "",
  isGroup = false,
  participants,
  onLeaveGroup,
  conversationId,
  isPendingRequest = false,
}: ClickableAvatarProps) {
 
  const handleClick = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    
    const position = calculatePopoverPosition(event);
    
    useUserActionPopoverStore.getState().show({
        user,
        position,
        isGroup,
        participants,
        onLeaveGroup,
        conversationId,
        isPendingRequest,
    });
    };

  return (
    <button
      onClick={handleClick}
      className={`flex-shrink-0 ${className}`}
    >
      <MiniAvatar
        imageUrl={user.profileImageUrl ?? (isGroup ? "/default-group.png" : "/default-avatar.png")}
        size={size}
        alt={user.fullName}
        withBorder={true}
      />
    </button>
  );
}
