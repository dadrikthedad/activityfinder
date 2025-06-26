// ParticipantsDropdownButton.tsx - forenklet med gjenbrukbar komponent
"use client";
import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom"; // NY IMPORT
import ProfileNavButton from "@/components/settings/ProfileNavButton";
import { UserSummaryDTO, GroupRequestStatus } from "@/types/UserSummaryDTO";
import { useOverlay } from "@/context/OverlayProvider";
import MiniAvatar from "../common/MiniAvatar";

interface ParticipantsDropdownButtonProps {
  participants: UserSummaryDTO[];
  className?: string;
  onShowUserPopover?: (user: UserSummaryDTO, event: React.MouseEvent) => void;
}

export default function ParticipantsDropdownButton({
  participants,
  className = "",
  onShowUserPopover
}: ParticipantsDropdownButtonProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  
  // NY: Beregn posisjon ved mount og oppdater kontinuerlig
  const [position, setPosition] = useState(() => {
    // Initial safe position
    return { x: -9999, y: -9999 }; // Utenfor skjermen til vi får riktig posisjon
  });
 
  // NY: Auto-level overlay
  const overlay = useOverlay();

  // NY: Oppdater posisjon kontinuerlig når ref endres
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

    // Oppdater posisjon når komponenten rendres
    updatePosition();
    
    // Oppdater på window resize
    window.addEventListener('resize', updatePosition);
    return () => window.removeEventListener('resize', updatePosition);
  }, []);

  // Sync overlay state with local state
  useEffect(() => {
    if (open && !overlay.isOpen) {
      overlay.open();
    } else if (!open && overlay.isOpen) {
      overlay.close();
    }
  }, [open, overlay]);

  const handleToggle = () => {
    setOpen(prev => !prev);
  };

  // NY: Bruk store-metoden for UserActionPopover
  const handleParticipantClick = (participant: UserSummaryDTO, event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    
    console.log('👥 Participant clicked:', participant.fullName);
    
    // ✅ Kall callback som kommer fra UserActionPopover
    if (onShowUserPopover) {
      onShowUserPopover(participant, event);
    }
  };


  // Hjelpefunksjon for status-info
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

  // Sortering
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
     
      {/* Bruk createPortal for smooth positioning - vis kun når position er klar */}
      {open && position.x > -9999 && createPortal(
        <div
          ref={overlay.ref}
          style={{ 
            position: 'fixed',
            top: position.y,
            left: position.x,
            zIndex: overlay.zIndex
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
        document.body // Portal til document.body
      )}
    </div>
  );
}