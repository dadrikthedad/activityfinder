"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import ProfileNavButton from "@/components/settings/ProfileNavButton";
import { UserSummaryDTO, GroupRequestStatus } from "@/types/UserSummaryDTO";
import { useOverlay, useOverlayAutoClose } from "@/context/OverlayProvider";
import MiniAvatar from "../MiniAvatar";
import NestedUserActionPopover from "./NestedUserActionPopover";
import { calculatePopoverPosition } from "../PopoverPositioning";

interface ParticipantsDropdownButtonProps {
  participants: UserSummaryDTO[];
  className?: string;
  onShowUserPopover?: (user: UserSummaryDTO, event: React.MouseEvent) => void;
  // ✅ NEW: For sending message directly from nested popover
  onSendMessageToUser?: (user: UserSummaryDTO) => void;
  // Optional prop to disable overlay system when used as nested component
  useOverlaySystem?: boolean;
}

export default function ParticipantsDropdownButton({
  participants,
  className = "",
  onShowUserPopover, // Keep this but we'll also handle locally
  onSendMessageToUser, // ✅ NEW: For direct message sending
  useOverlaySystem = true // Default to true for backwards compatibility
}: ParticipantsDropdownButtonProps) {
  // Always start closed - different from NewMessageWindow which should start open when nested
  const [isOpen, setIsOpen] = useState(false);
  const overlay = useOverlay(); // Always call useOverlay

  // SIMPLIFIED: Local nested UserActionPopover state
  const [nestedUserPopover, setNestedUserPopover] = useState<{
    user: UserSummaryDTO;
    position: { x: number; y: number };
  } | null>(null);

  const ref = useRef<HTMLDivElement>(null);
  
  // Position calculation
  const [position, setPosition] = useState(() => {
    return { x: -9999, y: -9999 }; // Off-screen until we get correct position
  });

  // Only register overlay when actually opening (not on mount)
  useEffect(() => {
    if (!useOverlaySystem && isOpen && !overlay.isOpen) {
      // Register for outside click detection only when opening
      overlay.open();
    }
  }, [useOverlaySystem, isOpen, overlay]);

  // Sync overlay state with local state (conditional logic inside)
  useEffect(() => {
    if (!useOverlaySystem) return;
    
    if (isOpen && !overlay.isOpen) {
      overlay.open();
    } else if (!isOpen && overlay.isOpen) {
      overlay.close();
    }
  }, [isOpen, overlay.isOpen, overlay.open, overlay.close, useOverlaySystem]);

  // Always call useOverlayAutoClose to listen for external closing
  useOverlayAutoClose(() => {
    if (useOverlaySystem) {
      setIsOpen(false);
    } else {
      // If not using overlay system, just close dropdown directly
      setIsOpen(false);
    }
    // Also close any nested popover when we close
    if (nestedUserPopover) {
      setNestedUserPopover(null);
    }
  }, overlay.level ?? undefined);

  // Update position continuously when ref changes
  useEffect(() => {
    const updatePosition = () => {
      if (ref.current) {
        const rect = ref.current.getBoundingClientRect();
        const dropdownWidth = 256;
        const rightEdge = rect.left + dropdownWidth;
        const adjustedX = rightEdge > window.innerWidth ? window.innerWidth - dropdownWidth - 16 : rect.left;
        
        setPosition({
          x: adjustedX,
          y: rect.bottom + 8
        });
      }
    };

    updatePosition();
    
    window.addEventListener('resize', updatePosition);
    return () => window.removeEventListener('resize', updatePosition);
  }, []);

  const handleToggle = useCallback(() => {
    setIsOpen(prev => !prev);
  }, [isOpen]);

  const handleParticipantClick = useCallback((participant: UserSummaryDTO, event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    
    
    // SIMPLIFIED: Calculate position and show reusable nested popover
    const pos = calculatePopoverPosition(event);
    
    setNestedUserPopover({ user: participant, position: pos });
    
    // OPTIONAL: Also call parent callback if provided (for backwards compatibility)
    if (onShowUserPopover) {
      onShowUserPopover(participant, event);
    }
  }, [onShowUserPopover]);

  // SIMPLIFIED: Handle nested popover closing
  const handleCloseNestedPopover = useCallback(() => {
    setNestedUserPopover(null);
  }, []);

  // ✅ FIXED: Handle send message from nested popover
  const handleNestedSendMessage = useCallback((user: UserSummaryDTO) => {
    
    // Close the nested popover first
    setNestedUserPopover(null);
    
    // ✅ Use the parent's send message handler if provided
    if (onSendMessageToUser) {
      onSendMessageToUser(user);
    } else {
      // Fallback: you could implement local message sending logic here
      // or show an alert/notification
      alert(`Send message to ${user.fullName} - no handler provided`);
    }
  }, [onSendMessageToUser]);

  // Helper function for status info
  const getStatusInfo = (participant: UserSummaryDTO) => {
    const status = participant.groupRequestStatus;
   
    if (status === "Creator" || status === GroupRequestStatus.Creator) {
      return { text: "(creator)", className: "text-green-800 font-semibold" };
    }
    if (status === "Pending" || status === GroupRequestStatus.Pending) {
      return { text: "(inv)", className: "text-gray-500" };
    }
    return null;
  };

  // Sorting
  const getStatusOrder = (status: GroupRequestStatus | string | null | undefined): number => {
    if (status === "Creator" || status === GroupRequestStatus.Creator) return 0;
    if (status === "Approved" || status === GroupRequestStatus.Approved) return 1;
    if (status === "Pending" || status === GroupRequestStatus.Pending) return 2;
    return 4;
  };

  const sortedParticipants = [...participants].sort((a, b) => 
    getStatusOrder(a.groupRequestStatus) - getStatusOrder(b.groupRequestStatus)
  );

  return (
    <div ref={ref} className={`relative w-auto flex flex-col items-center ${className}`}>
      <ProfileNavButton
        text="Participants"
        onClick={handleToggle}
        variant="small"
        className="bg-[#1C6B1C] hover:bg-[#0F3D0F] text-white"
      />
     
      {/* Conditional rendering based on local state */}
      {isOpen && position.x > -9999 && createPortal(
        <div
          ref={overlay.ref}
          style={{ 
            position: 'fixed',
            top: position.y,
            left: position.x,
            zIndex: overlay.zIndex // Always use overlay z-index
          }}
          className="w-64 min-h-[100px] bg-white dark:bg-[#1e2122] rounded-md shadow-lg border-2 border-[#1C6B1C]"
        >
          <div className="max-h-48 overflow-y-auto custom-scrollbar">
            {sortedParticipants.length === 0 ? (
              <div className="p-4 text-center text-gray-500">
                No participants found
              </div>
            ) : (
              sortedParticipants.map((participant) => {
              const statusInfo = getStatusInfo(participant);
             
              return (
                <button
                  key={participant.id}
                  className="flex items-center gap-3 w-full px-4 py-2 hover:bg-gray-200 dark:hover:bg-gray-700 text-sm overflow-hidden"
                  onClick={(e) => handleParticipantClick(participant, e)}
                >
                  <MiniAvatar
                    imageUrl={participant.profileImageUrl ?? "/default-avatar.png"}
                    size={32}
                    alt={participant.fullName}
                    withBorder={false}
                  />
                 
                  <div className="flex-1 text-left flex items-center justify-between min-w-0">
                    <span className="truncate">{participant.fullName}</span>
                    {statusInfo && (
                      <div className={`flex items-center gap-1 text-xs ${statusInfo.className} flex-shrink-0`}>
                        <span>{statusInfo.text}</span>
                      </div>
                    )}
                  </div>
                </button>
              );
            })
            )}
          </div>
        </div>,
        document.body
      )}

      {/* SIMPLIFIED: Use reusable NestedUserActionPopover component */}
      {nestedUserPopover && (
        <NestedUserActionPopover
          user={nestedUserPopover.user}
          position={nestedUserPopover.position}
          onClose={handleCloseNestedPopover}
          onSendMessage={handleNestedSendMessage}
        />
      )}
    </div>
  );
}