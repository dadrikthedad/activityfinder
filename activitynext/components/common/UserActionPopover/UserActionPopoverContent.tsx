// UserActionPopoverContent.tsx - Updated to handle nested send message
import EnlargeableImage from "@/components/common/EnlargeableImage";
import { UserSummaryDTO } from "@/types/UserSummaryDTO";
import ProfileNavButton from "../../settings/ProfileNavButton";
import DropdownNavButton from "../../DropdownNavButton";
import ParticipantsDropdownButton from "./UserActionParticipantDropdown";
import { useChatStore } from "@/store/useChatStore";
import { useGroupSettingsStore } from "@/components/groupmessages/useGroupSettingsStore";
import { calculatePopoverPosition } from "../PopoverPositioning"; 
import { useCallback } from "react";

interface Props {
  user: UserSummaryDTO;
  isOwner: boolean;
  isFriend: boolean;
  isFriendLoading: boolean;
  // Blocking props
  isBlocked?: boolean;
  hasBlockedMe?: boolean;
  isBlocking?: boolean;
  isUnblocking?: boolean;
  onBlock?: () => void;
  onUnblock?: () => void;
  // Props
  onVisitProfile: () => void;
  onSendMessage: () => void;
  onRemoveFriend: () => void;
  onClose: () => void;
  // Group props
  isGroup?: boolean;
  participants?: UserSummaryDTO[];
  onLeaveGroup?: () => void;
  onShowUserPopover?: (user: UserSummaryDTO, event: React.MouseEvent) => void;
  isPendingRequest?: boolean; 
  onInviteUsers?: () => void;
  conversationId?: number;
  //Handler for send message from nested context
  onSendMessageFromNested?: (user: UserSummaryDTO) => void;
  // Handler for opening invite users window
  onOpenInviteWindow?: (conversationId?: number, participants?: UserSummaryDTO[]) => void;
  isLeavingGroup?: boolean;
}

export default function UserActionPopoverContent({
  user,
  isOwner,
  isFriend,
  isFriendLoading,
  isBlocked = false,
  hasBlockedMe = false,
  isBlocking = false,
  isUnblocking = false,
  onBlock,
  onUnblock,
  onVisitProfile,
  onSendMessage,
  onRemoveFriend,
  onClose,
  isGroup = false,
  participants = [],
  onLeaveGroup,
  onShowUserPopover,
  isPendingRequest = false,
  onSendMessageFromNested,
  onOpenInviteWindow,
  isLeavingGroup,
  conversationId, 
}: Props) {

  // Get current group name from store for groups
  const currentConversation = useChatStore((state) => 
    isGroup && conversationId 
      ? state.conversations.find(conv => conv.id === conversationId)
      : null
  );
  
  // Use group name from store if available, otherwise fallback to user.fullName
  const displayName = isGroup && currentConversation?.groupName 
    ? currentConversation.groupName 
    : user.fullName;

// Dynamisk bilde som hentes fra store
  const displayImage = isGroup && currentConversation?.groupImageUrl 
  ? currentConversation.groupImageUrl 
  : (user.profileImageUrl || (isGroup ? "/default-group.png" : "/default-avatar.png"));
  
  // Handler for showing user popover - should NOT automatically send message
  const handleShowUserPopover = (targetUser: UserSummaryDTO, event: React.MouseEvent) => {
    // This should only show the popover, not send message
    if (onShowUserPopover) {
      onShowUserPopover(targetUser, event);
    }
  };

  // Handler for opening group settings
  const handleOpenGroupSettings = useCallback((event: React.MouseEvent) => {
    if (!conversationId) return;
    
    const position = calculatePopoverPosition(event);
    useGroupSettingsStore.getState().show({
      user,
      conversationId,
      position
    });
  }, [user, conversationId]);

  
  // ✅ Build dropdown actions based on current relationship status
  const buildDropdownActions = useCallback(() => {
    const actions = [];

    // Friend actions
    if (isFriend && onRemoveFriend) { // ✅ Check if function exists
      actions.push({ label: "Remove Friend", onClick: onRemoveFriend });
    }

    // Block/Unblock actions
    if (isBlocked && onUnblock) { // ✅ Check if function exists
      actions.push({ 
        label: isUnblocking ? "Unblocking..." : "Unblock", 
        onClick: onUnblock,
        disabled: isUnblocking
      });
    } else if (!hasBlockedMe && onBlock) { // ✅ Check if function exists
      actions.push({ 
        label: isBlocking ? "Blocking..." : "Block", 
        onClick: onBlock,
        disabled: isBlocking
      });
    }

    actions.push(
        { label: "Report", onClick: () => alert("Report clicked") }
      );
      
    return actions;
  }, [
    isFriend, 
    isBlocked, 
    hasBlockedMe, 
    isBlocking, 
    isUnblocking, 
    onRemoveFriend, 
    onBlock, 
    onUnblock
  ]);
  
  return (
    <div className="w-96 bg-white dark:bg-[#1e2122] shadow-md rounded-xl p-6 border-2 border-[#1C6B1C]">
      <div className="relative">
        <ProfileNavButton
          onClick={onClose}
          text="X"
          variant="smallx"
          className="absolute -top-8 -right-4 text-gray-500 hover:text-gray-700 text-lg font-bold flex items-center justify-center"
          aria-label="Close"
        />
        <div className="flex gap-12 mt-4 items-start">
          <div className="flex-shrink-0">
            <EnlargeableImage 
              src={displayImage}
              size={120} 
            />
            <div className="w-full mt-2 text-center break-words max-w-[120px]">
              <p className="text-lg font-semibold">{displayName}</p>
              {isGroup && (
                <p className="text-sm text-gray-500">{participants.length} medlemmer</p>
              )}
            </div>
          </div>
          
          <div className="flex flex-col justify-center flex-1 items-start space-y-2">
            {isGroup ? (
              <>
                {/* ParticipantsDropdownButton - pass both handlers separately */}
                <ParticipantsDropdownButton
                  participants={participants}
                  onShowUserPopover={handleShowUserPopover} // For showing popover
                  onSendMessageToUser={onSendMessageFromNested} // For sending message directly
                  useOverlaySystem={false} // Disable overlay system since we're already in an overlay
                />

                {/* Invite Users button - show only if not pending request */}
                {onOpenInviteWindow && !isPendingRequest && (
                  <ProfileNavButton
                    text="Invite Users"
                    onClick={() => onOpenInviteWindow?.(undefined, participants)}
                    variant="small"
                    className="bg-[#1C6B1C] hover:bg-[#0F3D0F] text-white"
                  />
                )}

                 {/* Group Settings button - only show if NOT pending */}
                {!isPendingRequest && (
                  <ProfileNavButton
                    text="Group Settings"
                    onClick={handleOpenGroupSettings}
                    variant="small"
                    className="bg-[#1C6B1C] hover:bg-[#0F3D0F] text-white"
                  />
                )}

                
                {/* Leave Group button - show only if NOT pending request */}
                {onLeaveGroup && !isPendingRequest && (
                  <ProfileNavButton
                    text={isLeavingGroup ? "Leaving..." : "Leave Group"} // Dynamic text
                    onClick={onLeaveGroup}
                    variant="small"
                    className={`text-white ${
                      isLeavingGroup 
                        ? 'bg-gray-400 cursor-not-allowed' // Disabled state
                        : 'bg-gray-500 hover:bg-gray-600' // Normal state
                    }`}
                    disabled={isLeavingGroup} // Disable when loading
                  />
                )}
              </>
            ) : (
              /* Individual user buttons */
              <>
                <ProfileNavButton
                  text="Visit Profile"
                  onClick={onVisitProfile}
                  variant="small"
                  className="bg-[#1C6B1C] hover:bg-[#0F3D0F] text-white"
                />
                {!isOwner && (
                  <>
                    {/* ✅ Hide Send Message if user has blocked us */}
                    {!hasBlockedMe && !isBlocked && (
                      <ProfileNavButton
                        text="Send Message"
                        onClick={onSendMessage}
                        variant="small"
                        className="bg-[#1C6B1C] hover:bg-[#0F3D0F] text-white"
                      />
                    )}

                    {!isFriendLoading && (
                      <DropdownNavButton
                        text="More Options"
                        variant="small"
                        className="self-start bg-gray-500 hover:bg-gray-600 text-white rounded-md"
                        actions={buildDropdownActions()} // ✅ Dynamic actions based on relationship
                      />
                    )}
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}