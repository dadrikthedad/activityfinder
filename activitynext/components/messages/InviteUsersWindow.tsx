// InviteUsersWindow.tsx - Overlay-based window for inviting users to groups
"use client";

import { useUserSearch } from "@/hooks/useUserSearch";
import { UserSummaryDTO } from "@/types/UserSummaryDTO";
import { useState, useRef, useEffect, useCallback } from "react";
import Card from "../common/Card";
import MiniAvatar from "../common/MiniAvatar";
import { useAuth } from "@/context/AuthContext";
import OverflowDropdown from "./NewMessageDropdown";
import { useKeyboardNavigableList } from "@/hooks/mouseAndKeyboard/useKeyboardForDropdown";
import ProfileNavButton from "../settings/ProfileNavButton";
import { useGroupRequests } from "@/hooks/messages/useGroupRequests";
import { useOverlay, useOverlayAutoClose } from "@/context/OverlayProvider";
import { createPortal } from "react-dom";

interface InviteUsersWindowProps {
  conversationId: number;
  groupName: string;
  existingParticipants?: UserSummaryDTO[]; // For å filtrere bort eksisterende medlemmer
  onClose: () => void;
  onInvitesSent?: (response: unknown) => void;
  initialPosition?: { x: number; y: number };
  // Optional prop to disable overlay system when used as nested component
  useOverlaySystem?: boolean;
}

export default function InviteUsersWindow({ 
  conversationId,
  groupName,
  existingParticipants = [],
  onClose,
  onInvitesSent,
  initialPosition,
  useOverlaySystem = true // Default to true for backwards compatibility
}: InviteUsersWindowProps) {
  
  const { query, setQuery, results, loading } = useUserSearch();
  const [selectedUsers, setSelectedUsers] = useState<UserSummaryDTO[]>([]);
  const { userId } = useAuth();
  const { sendGroupInvitations, isLoading, error } = useGroupRequests();
  
  // Always call hooks - simplified approach
  const [isOpen, setIsOpen] = useState(() => {
    console.log('👥 OVERLAY InviteUsersWindow initial state:', { useOverlaySystem, willBeOpen: !useOverlaySystem });
    return !useOverlaySystem; // If not using overlay, start open
  });
  const overlay = useOverlay(); // Always call useOverlay - we'll always register for outside click detection
  console.log('👥 OVERLAY InviteUsersWindow props received:', { 
    useOverlaySystem, 
    conversationId, 
    groupName, 
    existingParticipantCount: existingParticipants.length,
    isOpen 
  });

  const searchInputRef = useRef<HTMLInputElement>(null);
  const [showDropdown, setShowDropdown] = useState(false);

  // Window state
  const windowRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const offset = useRef({ x: 0, y: 0 });
  const [size] = useState({ width: 600, height: 450 });
  
  const defaultWidth = 600;
  const defaultHeight = 450;

  const [position, setPosition] = useState(() => ({
    x: initialPosition?.x ?? (window.innerWidth - defaultWidth) / 2,
    y: initialPosition?.y ?? (window.innerHeight - defaultHeight) / 2,
  }));

  // Filtrer bort current user og eksisterende deltakere
  const existingParticipantIds = existingParticipants.map(p => p.id);
  const filteredResults = results.filter(
    (user) =>
      user.id !== userId &&
      !existingParticipantIds.includes(user.id) &&
      !selectedUsers.some((u) => u.id === user.id)
  );

  const MAX_VISIBLE = 5;
  const visibleUsers = selectedUsers.slice(0, MAX_VISIBLE - 1);
  const overflowUsers = selectedUsers.slice(MAX_VISIBLE - 1);
  
  const keyboardNav = useKeyboardNavigableList(
    filteredResults,
    (user) => {
      if (!selectedUsers.find((u) => u.id === user.id)) {
        setSelectedUsers([...selectedUsers, user]);
      }
      setQuery("");
    },
    !!query
  );

  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleMouseEnter = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    setShowDropdown(true);
  };

  const handleMouseLeave = () => {
    hoverTimeoutRef.current = setTimeout(() => {
      setShowDropdown(false);
    }, 200);
  };

  // Auto-open when component mounts (only if using overlay system)
  useEffect(() => {
    if (useOverlaySystem) {
      console.log('👥 OVERLAY InviteUsersWindow mounting, will use full overlay state management');
      // Component starts with isOpen: true, so overlay.open() will be called in sync effect
    } else {
      // Always register for outside click detection, even when not using overlay state management
      console.log('👥 OVERLAY InviteUsersWindow mounting without overlay state management, but registering for outside clicks');
      overlay.open(); // Register as level, but don't use state management
    }
  }, [useOverlaySystem, overlay]);

  // Sync overlay state with local state (conditional logic inside)
  useEffect(() => {
    if (!useOverlaySystem) return;
    
    if (isOpen && !overlay.isOpen) {
      console.log('👥 OVERLAY InviteUsersWindow opening overlay');
      overlay.open();
    } else if (!isOpen && overlay.isOpen) {
      console.log('👥 OVERLAY InviteUsersWindow closing overlay');
      overlay.close();
    }
  }, [isOpen, overlay.isOpen, overlay.open, overlay.close, useOverlaySystem]);

  // Always call useOverlayAutoClose to listen for external closing
  useOverlayAutoClose(() => {
    console.log('👥 OVERLAY InviteUsersWindow auto-close triggered');
    if (useOverlaySystem) {
      setIsOpen(false);
    } else {
      // If not using overlay system, call onClose directly
      console.log('👥 OVERLAY InviteUsersWindow calling onClose directly');
      onClose();
    }
  }, overlay.level ?? undefined);

  // Drag and drop functionality
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;

      const newX = e.clientX - offset.current.x;
      const newY = e.clientY - offset.current.y;

      const windowElement = windowRef.current;
      const width = windowElement?.offsetWidth || 300;
      const height = windowElement?.offsetHeight || 200;

      const clampedX = Math.max(0, Math.min(window.innerWidth - width, newX));
      const clampedY = Math.max(0, Math.min(window.innerHeight - height, newY));

      setPosition({ x: clampedX, y: clampedY });
    };

    const handleMouseUp = () => setIsDragging(false);

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging]);

  const triggerRef = useRef<HTMLDivElement | null>(null);

  // Handle close consistently
  const handleClose = useCallback(() => {
    console.log('👥 OVERLAY InviteUsersWindow manual close', { useOverlaySystem });
    if (useOverlaySystem) {
      setIsOpen(false);
    } else {
      // If not using overlay system, call onClose directly
      onClose();
    }
  }, [useOverlaySystem, onClose]);

  // Auto-close on action completion (only if using overlay system)
  useEffect(() => {
    console.log('👥 OVERLAY InviteUsersWindow effect check:', { useOverlaySystem, isOpen, shouldTriggerClose: useOverlaySystem && !isOpen });
    
    // Only trigger onClose when overlay system is used AND isOpen becomes false AFTER being true
    if (useOverlaySystem && !isOpen && overlay.level !== null) {
      console.log('👥 OVERLAY InviteUsersWindow closed via overlay system, calling onClose');
      onClose();
    }
  }, [isOpen, onClose, useOverlaySystem, overlay.level]);

  const handleSendInvitations = async () => {
    if (selectedUsers.length === 0) return;

    try {
      console.log('👥 OVERLAY Sending invitations to:', selectedUsers.map(u => u.fullName));
      const response = await sendGroupInvitations({
        conversationId,
        invitedUserIds: selectedUsers.map(u => u.id)
      });

      if (response) {
        console.log("✅ Invitasjoner sendt:", response);
        onInvitesSent?.(response);
        handleClose();
      }
    } catch (err) {
      console.error("❌ Feil ved sending av invitasjoner:", err);
    }
  };

  // Conditional rendering based on local state (or always render if not using overlay)
  if (useOverlaySystem && !isOpen) {
    console.log('👥 OVERLAY InviteUsersWindow not rendering due to isOpen=false');
    return null;
  }

  return createPortal(
    <Card
      ref={(el) => {
        windowRef.current = el;
        // Always register for outside click detection
        overlay.ref(el);
      }}
      data-invite-users-window
      data-overlay-id="invite-users-window" // Give it an overlay ID so outside click detection works
      className="fixed max-w-[100vw] w-full min-w-[300px] min-h-[200px] border-2 border-[#1C6B1C] bg-white dark:bg-[#1e2122] text-black dark:text-white shadow-lg rounded-xl resize overflow-hidden flex flex-col"
      style={{
        left: position.x,
        top: position.y,
        width: size.width,
        height: size.height,
        minWidth: 500,
        minHeight: 300,
        maxWidth: window.innerWidth - 40,
        maxHeight: window.innerHeight - 40,
        zIndex: overlay.zIndex, // Always use overlay z-index
      }}
    >
      {/* Drag handle - header */}
      <div
        className="bg-[#1C6B1C] text-white px-4 py-2 flex justify-between items-center cursor-move select-none"
        onMouseDown={(e) => {
          const rect = windowRef.current?.getBoundingClientRect();
          if (rect) {
            offset.current = {
              x: e.clientX - rect.left,
              y: e.clientY - rect.top,
            };
            setIsDragging(true);
          }
        }}
      >
        <div className="font-semibold">
          Invite Users to {groupName}
        </div>
        <div className="flex gap-4">
          <button 
            onClick={() => setPosition({ x: 200, y: 200 })} 
            title="Reset Position"
            className="hover:bg-[#2a7a2a] rounded p-1"
          >
            ⟳
          </button>
          <button 
            onClick={handleClose} 
            title="Close"
            className="hover:bg-[#2a7a2a] rounded p-1"
          >
            ✕
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden">
        <div className="p-4 pt-0 mt-3 flex flex-col h-full">
          <div className="flex-1 min-h-0 overflow-hidden">
            {/* Search Input */}
            <input
              ref={searchInputRef}
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
              }}
              placeholder="Search users to invite..."
              className="w-full p-2 mb-2 border-1 rounded dark:bg-[#1e2122] dark:border-[#1C6B1C] focus:outline-none text-center"
            />

            {/* Search Results */}
            {query && (
              <ul className="w-full border border-[#1C6B1C] rounded bg-white dark:bg-[#1e2122] max-h-60 overflow-auto mb-4">
                {loading && <li className="p-2 text-center">Loading...</li>}
                {!loading && results.length === 0 && (
                  <li className="p-2 text-center text-gray-500">No users found</li>
                )}
                {!loading &&
                  filteredResults.map((user, index) => (
                    <li
                      key={user.id}
                      ref={keyboardNav.setItemRef(index)}
                      className={`p-2 cursor-pointer flex gap-3 items-center 
                          hover:bg-gray-100 dark:hover:bg-[#2a2e31] 
                          ${keyboardNav.activeIndex === index ? "bg-gray-100 dark:bg-[#2a2e31]" : ""}
                        `}
                      onClick={() => {
                        if (!selectedUsers.find((u) => u.id === user.id)) {
                          setSelectedUsers([...selectedUsers, user]);
                        }
                        setQuery("");
                        keyboardNav.setActiveIndex(0);
                        setTimeout(() => {
                          searchInputRef.current?.focus();
                        }, 0);
                      }}
                    >
                      <MiniAvatar
                        imageUrl={user.profileImageUrl ?? "/default-avatar.png"}
                        alt={user.fullName}
                        size={40}
                        withBorder={true}
                      />
                      <span>{user.fullName}</span>
                    </li>
                  ))}
              </ul>
            )}

            {/* Selected Users */}
            {selectedUsers.length > 0 && (
              <div className="mb-4 flex flex-wrap gap-2 relative">
                <div className="flex items-center text-sm text-gray-600 dark:text-gray-400 font-medium mr-2">
                  Selected:
                </div>
                {visibleUsers.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center gap-2 border border-[#1C6B1C] rounded-full px-2 py-1 bg-white dark:bg-[#2a2e31]"
                  >
                    <MiniAvatar
                      imageUrl={user.profileImageUrl ?? "/default-avatar.png"}
                      alt={user.fullName}
                      size={30}
                      withBorder={false}
                    />
                    <span className="text-sm">{user.fullName}</span>
                    <button
                      tabIndex={-1}
                      onClick={() =>
                        setSelectedUsers((prev) => prev.filter((u) => u.id !== user.id))
                      }
                      className="text-gray-500 hover:text-red-500 ml-1"
                    >
                      ✕
                    </button>
                  </div>
                ))}

                {overflowUsers.length > 0 && (
                  <div>
                    <div
                      ref={triggerRef}
                      onMouseEnter={handleMouseEnter}
                      onMouseLeave={handleMouseLeave}
                      className="px-3 py-1 border border-[#1C6B1C] rounded-full text-sm bg-white dark:bg-[#2a2e31] cursor-pointer select-none relative"
                    >
                      +{overflowUsers.length} more
                      {showDropdown && (
                        <OverflowDropdown
                          anchorRef={triggerRef}
                          users={overflowUsers}
                          onRemove={(id) =>
                            setSelectedUsers((prev) => prev.filter((u) => u.id !== id))
                          }
                        />
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Existing Participants Info */}
            {existingParticipants.length > 0 && (
              <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-800 rounded border">
                <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                  Current members ({existingParticipants.length}):
                </div>
                <div className="flex flex-wrap gap-2">
                  {existingParticipants.slice(0, 5).map((participant) => (
                    <div
                      key={participant.id}
                      className="flex items-center gap-1 text-xs bg-gray-200 dark:bg-gray-700 rounded-full px-2 py-1"
                    >
                      <MiniAvatar
                        imageUrl={participant.profileImageUrl ?? "/default-avatar.png"}
                        alt={participant.fullName}
                        size={20}
                        withBorder={false}
                      />
                      <span>{participant.fullName}</span>
                    </div>
                  ))}
                  {existingParticipants.length > 5 && (
                    <div className="text-xs text-gray-500 px-2 py-1">
                      +{existingParticipants.length - 5} more
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Error Display */}
            {error && (
              <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/20 border border-red-300 dark:border-red-700 rounded text-red-700 dark:text-red-300">
                {error}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="shrink-0 mt-4 flex gap-2 justify-end">
            <ProfileNavButton
              text="Cancel"
              onClick={handleClose}
              variant="small"
              className="bg-gray-500 hover:bg-gray-600 text-white"
              disabled={isLoading}
            />
            <ProfileNavButton
              text={isLoading ? "Sending..." : `Send Invitations (${selectedUsers.length})`}
              onClick={handleSendInvitations}
              variant="small"
              className="bg-[#1C6B1C] hover:bg-[#0F3D0F] text-white"
              disabled={selectedUsers.length === 0 || isLoading}
            />
          </div>
        </div>
      </div>
    </Card>,
    document.body
  );
}