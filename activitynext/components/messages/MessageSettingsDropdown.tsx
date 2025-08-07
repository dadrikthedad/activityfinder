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
import { UserSummaryDTO } from "@shared/types/UserSummaryDTO";
import ParticipantsList from "./ParticipantsListProps";
import { calculatePopoverPosition } from "../common/PopoverPositioning";
import { useDeleteConversation } from "@/hooks/messages/useDeleteConversation";
import { useConfirmDialog } from "@/hooks/useConfirmDialog";
import { useAuth } from "@/context/AuthContext";


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
  useOverlaySystem?: boolean; // ✅ NEW: Support for nested usage
}

export default function MessageSettingsDropdown({ 
  open, 
  setOpen, 
  onShowUserPopover,
  useOverlaySystem = true // ✅ Default to true for backwards compatibility
}: MessageSettingsDropdownProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const searchMode = useChatStore((s) => s.searchMode);
  const setSearchMode = useChatStore((s) => s.setSearchMode);
  const { resetSearch } = useSearchMessages();
  const [showParticipants, setShowParticipants] = useState(false);
  
  // Follow same pattern as other overlay components
  const settingsOverlay = useOverlay();
  const participantsOverlay = useOverlay();
  
  // Hent conversation data fra store
  const currentConversationId = useChatStore((s) => s.currentConversationId);
  const currentConversation = useChatStore((s) => 
    s.conversations.find((c) => c.id === currentConversationId)
  );
  const participants = currentConversation?.participants || [];
  const isGroup = currentConversation?.isGroup || false;

  

  // Sletting av en samtale
  const { deleteConversationMutation, isDeleting } = useDeleteConversation();
  const { confirm, ConfirmDialog } = useConfirmDialog();

  const { userId: currentUserId } = useAuth();

  // Sync settings dropdown state with overlay (conditional logic inside)
  useEffect(() => {
    if (!useOverlaySystem) {
      // When not using overlay system, register only when opening
      if (open && !settingsOverlay.isOpen) {
        settingsOverlay.open();
      }
      return;
    }

    // Normal overlay state management
    if (open && !settingsOverlay.isOpen) {
      settingsOverlay.open();
    } else if (!open && settingsOverlay.isOpen) {
      settingsOverlay.close();
    }
  }, [open, settingsOverlay, useOverlaySystem]);
  

  // Sync participants list state with overlay
  useEffect(() => {
    if (showParticipants && !participantsOverlay.isOpen) {
      participantsOverlay.open();
    } else if (!showParticipants && participantsOverlay.isOpen) {
      participantsOverlay.close();
    }
  }, [showParticipants, participantsOverlay]);

  // Auto-close settings dropdown when overlay closes
  useOverlayAutoClose(() => {
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

  // Auto-close participants when its overlay closes
  useOverlayAutoClose(() => {
    setShowParticipants(false);
  }, participantsOverlay.level ?? undefined);

  const handleShowParticipants = useCallback(() => {
    setShowParticipants(true);
    setOpen(false); // Lukk settings dropdown
  }, [setOpen]);

  const handleCloseParticipants = useCallback(() => {

    setShowParticipants(false);
    setOpen(true); // Åpne settings dropdown igjen
  }, [setOpen]);

  // Håndter klikk på deltaker - IKKE send gruppedata for enkeltbrukere
  const handleParticipantClick = useCallback((participant: UserSummaryDTO, event: React.MouseEvent) => {
    event.stopPropagation();
    
    const pos = calculatePopoverPosition(event);
    
    // ✅ For individuelle deltakere: IKKE send gruppedata, bare brukeren
    onShowUserPopover?.(participant, pos);
  }, [onShowUserPopover]);

  // Håndter klikk på gruppe-header
  const handleGroupHeaderClick = useCallback((event: React.MouseEvent) => {
    if (!isGroup || !currentConversation || !currentConversationId) return;
    event.stopPropagation();
    
    const pos = calculatePopoverPosition(event);
    
    const groupUser: UserSummaryDTO = {
      id: currentConversation.id,
      fullName: currentConversation.groupName || "Navnløs gruppe",
      profileImageUrl: currentConversation.groupImageUrl || "/default-group.png",
    };
    
    const groupData = {
      isGroup: true,
      participants: participants,
      isPendingRequest: false,
      conversationId: currentConversationId
    };
    
    onShowUserPopover?.(groupUser, pos, groupData);
  }, [isGroup, currentConversation, currentConversationId, participants, onShowUserPopover]);

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

  //Sletting av en samtale
  const handleDeleteConversation = useCallback(async () => {
    if (!currentConversationId || isGroup) return;
    
    const otherParticipant = participants.find(p => p.id !== currentUserId);
    const conversationName = otherParticipant?.fullName || "this conversation";
    const isPending = currentConversation?.isPendingApproval;
    
    // ✅ Different messages for pending vs regular conversations
    const confirmed = await confirm({
      title: isPending ? "Remove Pending Request" : "Delete Conversation",
      message: isPending ? (
        <div className="space-y-2">
          <p>Are you sure you want to remove the pending conversation request with <strong>{conversationName}</strong>?</p>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            You will no longer see this conversation, but you will receive a notification if the receiver accepts your request.  
            You can restore the conversation later via <strong>TODO</strong>.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <p>Are you sure you want to delete the conversation with <strong>{conversationName}</strong>?  
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            You will no longer be able to view, send, or receive messages in this conversation.
            You can restore this conversation later via <strong>TODO</strong>.
          </p>
        </div>
      )
    });
    
    // ✅ Only proceed if user confirmed
    if (!confirmed) return;
    
    try {
      await deleteConversationMutation(currentConversationId);
      setOpen(false);
      
      console.log(isPending ? '✅ Pending request removed successfully!' : '✅ Samtale slettet successfully!');
      
    } catch (error) {
      console.error(isPending ? 'Kunne ikke fjerne pending request:' : 'Kunne ikke slette samtale:', error);
      // Error håndteres av hook
    }
  }, [currentConversationId, isGroup, deleteConversationMutation, setOpen, confirm, participants, currentUserId, currentConversation?.isPendingApproval]);

  return (
    <>
      {/* ✅ NEW: Render confirm dialog */}
      <ConfirmDialog />
    
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

          {!isGroup && currentConversationId && (
            <button
              onClick={handleDeleteConversation}
              disabled={isDeleting}
              className="block w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-[#2a2d2e] text-gray-400 dark:text-gray-400 border-b border-gray-200 dark:border-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isDeleting ? 'Deleting...' : 'Delete conversation'}
            </button>
          )}
          
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
    </>
  );
}