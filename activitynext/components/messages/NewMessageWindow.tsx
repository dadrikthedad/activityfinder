import { useUserSearch } from "@/hooks/useUserSearch";
import { UserSummaryDTO } from "@shared/types/UserSummaryDTO";
import { MessageDTO } from "@shared/types/MessageDTO";
import { SendGroupRequestsResponseDTO } from "@shared/types/SendGroupRequestsDTO";
import { useState, useRef, useEffect, useCallback } from "react";
import NewMessageInput from "./NewMessageInput";
import Card from "../common/Card";
import MiniAvatar from "../common/MiniAvatar";
import { useAuth } from "@/context/AuthContext";
import OverflowDropdown from "./NewMessageDropdown";
import { useKeyboardNavigableList } from "@/hooks/mouseAndKeyboard/useKeyboardForDropdown";
import { useOverlay, useOverlayAutoClose } from "@/context/OverlayProvider";
import { createPortal } from "react-dom";
import { useUploadGroupImage } from "@/hooks/image/useUploadGroupImage";
import ProfileNavButton from "../settings/ProfileNavButton";
import EnlargeableImage from "../common/EnlargeableImage";

interface NewMessageWindowProps {
  initialReceiver?: UserSummaryDTO;
  onClose: () => void;
  onMessageSent?: (message: MessageDTO) => void;
  onGroupCreated?: (response: SendGroupRequestsResponseDTO) => void;
  initialPosition?: { x: number; y: number };
  // ✅ NEW: Optional prop to disable overlay system when used as nested component
  useOverlaySystem?: boolean;
}

export default function NewMessageWindow({ 
  initialReceiver, 
  onClose, 
  onMessageSent, 
  onGroupCreated,
  initialPosition,
  useOverlaySystem = true // Default to true for backwards compatibility
}: NewMessageWindowProps) {
  
  const { query, setQuery, results, loading } = useUserSearch();
  const [selectedUsers, setSelectedUsers] = useState<UserSummaryDTO[]>([]);
  const { userId } = useAuth();
  
  // Always call hooks - simplified approach
  const [isOpen, setIsOpen] = useState(() => {
    return !useOverlaySystem; // If not using overlay, start open
  });
  const overlay = useOverlay(); // Always call useOverlay - we'll always register for outside click detection
  
  const [groupName, setGroupName] = useState("");
  const [groupImageUrl, setGroupImageUrl] = useState<string | null>(null);
  const { upload: uploadGroupImage, uploading: uploadingImage, error: uploadError } = useUploadGroupImage();
  

  const hasInitialReceiver = !!initialReceiver;
  const isMultipleUsers = selectedUsers.length > 1;

  const searchInputRef = useRef<HTMLInputElement>(null);
  const [shouldFocusMessageInput, setShouldFocusMessageInput] = useState(false);

  const [showDropdown, setShowDropdown] = useState(false);

  // Window state
  const windowRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const offset = useRef({ x: 0, y: 0 });
  const [size] = useState({ width: 700, height: 500 });
  
  const defaultWidth = 700;
  const defaultHeight = 500;

  const [position, setPosition] = useState(() => ({
    x: initialPosition?.x ?? (window.innerWidth - defaultWidth) / 2,
    y: initialPosition?.y ?? (window.innerHeight - defaultHeight) / 2,
  }));

  const filteredResults = results.filter(
    (user) =>
      user.id !== userId &&
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
  
  // Last opp gruppebilde
  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      console.log("🔄 Uploading file:", file.name);
      const imageUrl = await uploadGroupImage(file);
      console.log("✅ Got imageUrl:", imageUrl);
      if (imageUrl) {
        setGroupImageUrl(imageUrl);
        console.log("📝 Set groupImageUrl to:", imageUrl);
      }
    } catch (err) {
      console.error("Failed to upload group image:", err);
    }
  };

  // Fjern bilde
  const removeGroupImage = () => {
    setGroupImageUrl(null);
  };


  // Auto-open when component mounts (only if using overlay system)
  useEffect(() => {
    if (useOverlaySystem) {
      // Component starts with isOpen: true, so overlay.open() will be called in sync effect
    } else {
      // Always register for outside click detection, even when not using overlay state management
      overlay.open(); // Register as level, but don't use state management
    }
  }, [useOverlaySystem, overlay]);

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
      // If not using overlay system, call onClose directly
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

  useEffect(() => {
    if (initialReceiver && !selectedUsers.find((u) => u.id === initialReceiver.id)) {
      setSelectedUsers([initialReceiver]);
      setQuery("");
    }
  }, [initialReceiver, selectedUsers, setQuery]);

  // ✅ Handle close consistently
  const handleClose = useCallback(() => {
    if (useOverlaySystem) {
      setIsOpen(false);
    } else {
      // If not using overlay system, call onClose directly
      onClose();
    }
  }, [useOverlaySystem, onClose]);

  // Auto-close on action completion (only if using overlay system)
  useEffect(() => {
    
    // ✅ FIXED: Only trigger onClose when overlay system is used AND isOpen becomes false AFTER being true
    if (useOverlaySystem && !isOpen && overlay.level !== null) {
      onClose();
    }
  }, [isOpen, onClose, useOverlaySystem, overlay.level]);

  const handleMessageSent = useCallback((message: MessageDTO) => {
    onMessageSent?.(message);
    handleClose();
  }, [onMessageSent, handleClose]);

  const handleGroupCreated = useCallback((response: SendGroupRequestsResponseDTO) => {
    onGroupCreated?.(response);
    handleClose();
  }, [onGroupCreated, handleClose]);

  // ✅ Conditional rendering based on local state (or always render if not using overlay)
  if (useOverlaySystem && !isOpen) {
    return null;
  }

  return createPortal(
    <Card
      ref={(el) => {
        windowRef.current = el;
        // ✅ Always register for outside click detection
        overlay.ref(el);
      }}
      data-new-message-window
      data-overlay-id="new-message-window" // ✅ Give it an overlay ID so outside click detection works
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
        zIndex: overlay.zIndex, // ✅ Always use overlay z-index (will be level 2)
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
          {isMultipleUsers ? "New Group Conversation" : "New Conversation"}
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
        <div className="p-4 pt-3 flex flex-col h-full">
          <div className="flex-1 min-h-0 overflow-hidden">
            {!hasInitialReceiver && (
              <>
                <input
                  ref={searchInputRef}
                  type="text"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                  }}
                  placeholder="Search users..."
                  className="w-full p-2 mb-2 border-1 rounded dark:bg-[#1e2122] dark:border-[#1C6B1C] focus:outline-none text-center"
                  onBlur={() => {
                    if (selectedUsers.length > 0) {
                      setShouldFocusMessageInput(true);
                    }
                  }}
                />

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
              </>
            )}

            {selectedUsers.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-2 relative">
                <div className="flex items-center text-sm text-gray-600 dark:text-gray-400 font-medium mr-2">
                  To:
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
                    {!hasInitialReceiver && (
                      <button
                        tabIndex={-1}
                        onClick={() =>
                          setSelectedUsers((prev) => prev.filter((u) => u.id !== user.id))
                        }
                        className="text-gray-500 hover:text-red-500 ml-1"
                      >
                        ✕
                      </button>
                    )}
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

            {/* Group name input for multiple users */}
            {isMultipleUsers && (
              <div className="mb-6">
                {/* Gruppe navn input */}
                <input
                  type="text"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="Group name (optional)"
                  maxLength={100}
                  className="w-full p-3 border-1 rounded-lg dark:bg-[#1e2122] dark:border-[#1C6B1C] focus:outline-none text-sm text-center mb-4"
                />
                
                {/* Gruppe bilde seksjon */}
                <div className="flex flex-col items-center space-y-4">
                  {groupImageUrl ? (
                    <div className="relative mb-2">
                      <EnlargeableImage
                        src={groupImageUrl}
                        alt="Group"
                        size={80}
                        className="border-2 border-[#1C6B1C]"
                      />
                      
                      <button
                        onClick={removeGroupImage}
                        className="absolute -top-1 -right-1 bg-gray-500 hover:bg-gray-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs transition-colors"
                        title="Remove image"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <div className="w-20 h-20 rounded-full border-2 border-dashed border-[#1C6B1C] flex items-center justify-center bg-gray-50 dark:bg-[#2a2e31] mb-2">
                    </div>
                  )}
                  
                  {/* Bilde upload knapp */}
                  <input
                    id="group-image-upload"
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                    disabled={uploadingImage}
                  />
                  <ProfileNavButton
                    text={uploadingImage ? "Uploading..." : groupImageUrl ? "Change Image" : "Add Image"}
                    variant="small"
                    onClick={() => document.getElementById('group-image-upload')?.click()}
                    disabled={uploadingImage}
                  />
                                    
                  {/* Feilmelding */}
                  {uploadError && (
                    <p className="text-red-500 text-xs mt-2">{uploadError}</p>
                  )}
                </div>
              </div>
            )}
                      </div>

                      {selectedUsers.length > 0 && (
            <div className="shrink-0 mt-4">
              <NewMessageInput
                receiverId={isMultipleUsers ? undefined : selectedUsers[0].id}
                selectedUsers={isMultipleUsers ? selectedUsers : undefined}
                groupName={isMultipleUsers ? groupName : undefined}
                groupImageUrl={isMultipleUsers ? groupImageUrl : undefined}
                shouldFocus={shouldFocusMessageInput}
                onMessageSent={handleMessageSent}
                onGroupCreated={handleGroupCreated}
              />
            </div>
          )}
        </div>
      </div>
    </Card>,
    document.body
  );
}