// Knappen i toolbaren med innstillinger til en chat
// MessageSettingsDropdown.tsx - Updated to use overlay system properly
"use client";
import { useRef, useEffect, useState, useCallback } from "react";
import { Settings } from "lucide-react";
import ProfileNavButton from "../settings/ProfileNavButton";
import MiniAvatar from "../common/MiniAvatar";
import { useOverlay, useOverlayAutoClose } from "@/context/OverlayProvider";
import { useChatStore } from "@/store/useChatStore";
import { useSearchMessages } from "@/hooks/messages/useSearchMessages";
import { UserSummaryDTO } from "@/types/UserSummaryDTO";
import ParticipantsList from "./ParticipantsListProps";

interface MessageSettingsDropdownProps {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  onShowUserPopover?: (
    user: UserSummaryDTO, 
    pos: { x: number; y: number },
    groupData?: {
      isGroup: boolean;
      participants: UserSummaryDTO[];
      onLeaveGroup?: () => void;
      isPendingRequest?: boolean;
      conversationId?: number;
    }
  ) => void;
  onLeaveGroup?: (conversationId: number) => Promise<void>;
  useOverlaySystem?: boolean; // ✅ NEW: Support for nested usage
}

export default function MessageSettingsDropdown({ 
  open, 
  setOpen, 
  onShowUserPopover,
  onLeaveGroup,
  useOverlaySystem = true // ✅ Default to true for backwards compatibility
}: MessageSettingsDropdownProps) {
  console.log('⚙️ OVERLAY MessageSettingsDropdown props received:', { useOverlaySystem, open });

  const containerRef = useRef<HTMLDivElement>(null);
  const searchMode = useChatStore((s) => s.searchMode);
  const setSearchMode = useChatStore((s) => s.setSearchMode);
  const { resetSearch } = useSearchMessages();
  const [showParticipants, setShowParticipants] = useState(false);
  
  // ✅ Follow same pattern as other overlay components
  const settingsOverlay = useOverlay();
  const participantsOverlay = useOverlay();
  
  // 🎯 Hent conversation data fra store
  const currentConversationId = useChatStore((s) => s.currentConversationId);
  const currentConversation = useChatStore((s) => 
    s.conversations.find((c) => c.id === currentConversationId)
  );
  const participants = currentConversation?.participants || [];
  const isGroup = currentConversation?.isGroup || false;

  // ✅ Sync settings dropdown state with overlay (conditional logic inside)
  useEffect(() => {
    if (!useOverlaySystem) {
      // When not using overlay system, register only when opening
      if (open && !settingsOverlay.isOpen) {
        console.log('⚙️ OVERLAY MessageSettingsDropdown opening without overlay state management, but registering for outside clicks');
        settingsOverlay.open();
      }
      return;
    }

    // Normal overlay state management
    if (open && !settingsOverlay.isOpen) {
      console.log('⚙️ OVERLAY MessageSettingsDropdown opening overlay');
      settingsOverlay.open();
    } else if (!open && settingsOverlay.isOpen) {
      console.log('⚙️ OVERLAY MessageSettingsDropdown closing overlay');
      settingsOverlay.close();
    }
  }, [open, settingsOverlay, useOverlaySystem]);

  // ✅ Sync participants list state with overlay
  useEffect(() => {
    if (showParticipants && !participantsOverlay.isOpen) {
      console.log('⚙️ OVERLAY MessageSettingsDropdown opening participants overlay');
      participantsOverlay.open();
    } else if (!showParticipants && participantsOverlay.isOpen) {
      console.log('⚙️ OVERLAY MessageSettingsDropdown closing participants overlay');
      participantsOverlay.close();
    }
  }, [showParticipants, participantsOverlay]);

  // ✅ Auto-close settings dropdown when overlay closes
  useOverlayAutoClose(() => {
    console.log('⚙️ OVERLAY MessageSettingsDropdown auto-close triggered');
    if (useOverlaySystem) {
      setOpen(false);
    } else {
      setOpen(false);
    }
    // Also close participants if open
    if (showParticipants) {
      setShowParticipants(false);
    }
  }, settingsOverlay.level ?? undefined);

  // ✅ Auto-close participants when its overlay closes
  useOverlayAutoClose(() => {
    console.log('⚙️ OVERLAY MessageSettingsDropdown participants auto-close triggered');
    setShowParticipants(false);
  }, participantsOverlay.level ?? undefined);

  const handleShowParticipants = useCallback(() => {
    console.log('⚙️ OVERLAY Showing participants');
    setShowParticipants(true);
    setOpen(false); // Lukk settings dropdown
  }, [setOpen]);

  const handleCloseParticipants = useCallback(() => {
    console.log('⚙️ OVERLAY Closing participants');
    setShowParticipants(false);
    setOpen(true); // Åpne settings dropdown igjen
  }, [setOpen]);

  // ✅ Håndter klikk på deltaker - IKKE send gruppedata for enkeltbrukere
  const handleParticipantClick = useCallback((participant: UserSummaryDTO, event: React.MouseEvent) => {
    event.stopPropagation();
    
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const pos = {
      x: rect.left + window.scrollX,
      y: rect.bottom + window.scrollY + 8,
    };
    
    // ✅ For individuelle deltakere: IKKE send gruppedata, bare brukeren
    onShowUserPopover?.(participant, pos);
  }, [onShowUserPopover]);

  // ✅ Håndter klikk på gruppe-header
  const handleGroupHeaderClick = useCallback((event: React.MouseEvent) => {
    if (!isGroup || !currentConversation || !currentConversationId) return;
    
    event.stopPropagation();
    
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const pos = {
      x: rect.left + window.scrollX,
      y: rect.bottom + window.scrollY + 8,
    };
    
    const groupUser: UserSummaryDTO = {
      id: currentConversation.id,
      fullName: currentConversation.groupName || "Navnløs gruppe",
      profileImageUrl: currentConversation.groupImageUrl || "/default-group.png",
    };
    
    const groupData = {
      isGroup: true,
      participants: participants,
      onLeaveGroup: () => onLeaveGroup?.(currentConversationId),
      isPendingRequest: false,
      conversationId: currentConversationId
    };
    
    onShowUserPopover?.(groupUser, pos, groupData);
  }, [isGroup, currentConversation, currentConversationId, participants, onLeaveGroup, onShowUserPopover]);

  const handleSearchToggle = useCallback(() => {
    if (searchMode) {
      resetSearch();
      setSearchMode(false);
      useChatStore.getState().setSearchResults([]);
    } else {
      setSearchMode(true);
    }
    setOpen(false);
  }, [searchMode, resetSearch, setSearchMode, setOpen]);

  return (
    <div className="relative" ref={containerRef}>
      <ProfileNavButton
        variant="smallx"
        text={<Settings size={18} />}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((prev) => !prev);
        }}
        aria-label="Settings"
        className="bg-[#1C6B1C] hover:bg-[#0F3D0F] text-white flex items-center justify-center"
      />
      
      {open && !showParticipants && (
        <div
          ref={settingsOverlay.ref}
          style={{ zIndex: settingsOverlay.zIndex }}
          className="absolute bottom-full mb-2 right-0 bg-white dark:bg-[#1e2122] shadow-lg border border-gray-200 dark:border-[#1C6B1C] rounded-md min-w-48"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={handleSearchToggle}
            className="block w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-[#2a2d2e] border-b border-gray-200 dark:border-gray-600"
          >
            Search messages
          </button>
          
          {isGroup && (
            <button 
              onClick={handleShowParticipants}
              className="block w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-[#2a2d2e]"
              disabled={participants.length === 0 || !currentConversationId}
            >
              Show participants ({participants.length})
            </button>
          )}
        </div>
      )}
      
      {/* 🆕 Participants liste - egen modal/dropdown */}
      {showParticipants && participants.length > 0 && (
        <div 
          ref={participantsOverlay.ref}
          style={{ zIndex: participantsOverlay.zIndex }}
          className="absolute bottom-full mb-2 right-0 bg-white dark:bg-[#1e2122] shadow-lg border border-gray-200 dark:border-[#1C6B1C] rounded-md min-w-64 max-w-80 w-80"
          onClick={(e) => e.stopPropagation()}
        >
          {/* ✅ Gruppe-header (kun for grupper) */}
          {isGroup && currentConversation && (
            <>
              <button
                className="flex items-center gap-3 w-full px-4 py-3 hover:bg-gray-100 dark:hover:bg-gray-700 border-b border-gray-200 dark:border-gray-600 overflow-hidden"
                onClick={handleGroupHeaderClick}
              >
                <MiniAvatar
                  imageUrl={currentConversation.groupImageUrl ?? "/default-group.png"}
                  size={32}
                  alt={currentConversation.groupName || "Gruppe"}
                  withBorder={false}
                />
                <div className="text-left min-w-0 flex-1">
                  <div className="font-semibold truncate">
                    {currentConversation.groupName || "Navnløs gruppe"}
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400 truncate">
                    Group settings
                  </div>
                </div>
              </button>
            </>
          )}
          
          {/* ✅ Participants header */}
          <div className="px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-gray-600">
            Participants ({participants.length})
          </div>
          
          {/* ✅ Participants liste */}
          <ParticipantsList
            participants={participants}
            onParticipantClick={handleParticipantClick}
            showGroupRequestStatus={true}
          />
          
          {/* ✅ Tilbake-knapp */}
          <div className="border-t border-gray-200 dark:border-gray-600">
            <button
              onClick={handleCloseParticipants}
              className="block w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-[#2a2d2e] text-sm text-gray-600 dark:text-gray-400"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}