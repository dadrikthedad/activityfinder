// ParticipantsDropdownButton.tsx
"use client";

import { useState, useRef, useEffect } from "react";
import ProfileNavButton from "@/components/settings/ProfileNavButton";
import { useDropdown } from "@/context/DropdownContext";
import { UserSummaryDTO } from "@/types/FriendInvitationDTO";
import MiniAvatar from "./MiniAvatar";
import { useClickOutsideGroups } from "@/hooks/mouseAndKeyboard/useClickOutside";

interface ParticipantsDropdownButtonProps {
  participants: UserSummaryDTO[];
  onShowUserPopover: (user: UserSummaryDTO, pos: { x: number; y: number }) => void;
  className?: string;
}

export default function ParticipantsDropdownButton({ 
  participants, 
  onShowUserPopover, 
  className = "" 
}: ParticipantsDropdownButtonProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const dropdownContext = useDropdown();

  useEffect(() => {
    if (!open) return;
    const id = "participants-dropdown";
    const close = () => setOpen(false);
    dropdownContext.register({ id, close });
    return () => dropdownContext.unregister(id);
  }, [open, dropdownContext]);

  useClickOutsideGroups({
      includeRefs: [ref],
      excludeClassNames: [
          "[data-user-action-popover]",
          "[data-nested-user-popover]",
          "[data-nested-popover]"
      ],
      onOutsideClick: () => setOpen(false),
      isActive: open
  });

    const handleParticipantClick = (participant: UserSummaryDTO, event: React.MouseEvent) => {
  event.stopPropagation();
  
  // ✅ Samme som ConversationListItem håndterer avatar klikk
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
  const pos = {
    x: rect.left + window.scrollX,
    y: rect.bottom + window.scrollY + 8, // Litt under elementet
  };
  
  onShowUserPopover(participant, pos);
};

    return (
    <div ref={ref} className={`relative w-auto flex flex-col items-center ${className}`}>
      <ProfileNavButton
        text="Participants"
        onClick={() => setOpen(prev => !prev)}
        variant="small"
        className="bg-[#1C6B1C] hover:bg-[#0F3D0F] text-white"
      />

      {open && (
        <div className="absolute top-full mt-2 w-64 bg-white dark:bg-[#1e2122] rounded-md shadow-lg z-30 border-2 border-[#1C6B1C] max-h-64 overflow-y-auto">
          {participants.map((participant) => (
            <button
              key={participant.id}
              className="flex items-center gap-3 w-full px-4 py-2 hover:bg-gray-200 dark:hover:bg-gray-700 text-sm"
              onClick={(e) => handleParticipantClick(participant, e)} // ✅ Send event
            >
              <MiniAvatar 
                imageUrl={participant.profileImageUrl ?? "/default-avatar.png"} 
                size={32} 
                alt={participant.fullName}
              />
              <span className="text-left">{participant.fullName}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}