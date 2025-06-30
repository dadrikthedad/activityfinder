// UserActionPopoverContent.tsx - Updated to handle nested send message
import EnlargeableImage from "@/components/common/EnlargeableImage";
import { UserSummaryDTO } from "@/types/UserSummaryDTO";
import ProfileNavButton from "../../settings/ProfileNavButton";
import DropdownNavButton from "../../DropdownNavButton";
import ParticipantsDropdownButton from "./UserActionParticipantDropdown";

interface Props {
  user: UserSummaryDTO;
  isOwner: boolean;
  isFriend: boolean;
  isFriendLoading: boolean;
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
  // ✅ NEW: Handler for send message from nested context
  onSendMessageFromNested?: (user: UserSummaryDTO) => void;
  // ✅ NEW: Handler for opening invite users window
  onOpenInviteWindow?: (conversationId?: number, participants?: UserSummaryDTO[]) => void;
}

export default function UserActionPopoverContent({
  user,
  isOwner,
  isFriend,
  isFriendLoading,
  onVisitProfile,
  onSendMessage,
  onRemoveFriend,
  onClose,
  isGroup = false,
  participants = [],
  onLeaveGroup,
  onShowUserPopover,
  isPendingRequest = false,
  onSendMessageFromNested, // ✅ NEW prop
  onOpenInviteWindow, // ✅ NEW prop
}: Props) {
  
  // ✅ FIXED: Handler for showing user popover - should NOT automatically send message
  const handleShowUserPopover = (targetUser: UserSummaryDTO, event: React.MouseEvent) => {
    console.log('👥 CONTENT handleShowUserPopover called for:', targetUser.fullName);
    
    // This should only show the popover, not send message
    if (onShowUserPopover) {
      onShowUserPopover(targetUser, event);
    }
  };

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
              src={user.profileImageUrl ?? (isGroup ? "/default-group.png" : "/default-avatar.png")} 
              size={120} 
            />
            <div className="w-full mt-2 text-center break-words max-w-[120px]">
              <p className="text-lg font-semibold">{user.fullName}</p>
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
                  onSendMessageToUser={onSendMessageFromNested} // ✅ NEW: For sending message directly
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
                
                {/* Leave Group button - show only if NOT pending request */}
                {onLeaveGroup && !isPendingRequest && (
                  <ProfileNavButton
                    text="Leave Group"
                    onClick={onLeaveGroup}
                    variant="small"
                    className="bg-gray-500 hover:bg-gray-600 text-white"
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
                    <ProfileNavButton
                      text="Send Message"
                      onClick={onSendMessage}
                      variant="small"
                      className="bg-[#1C6B1C] hover:bg-[#0F3D0F] text-white"
                    />
                    {!isFriendLoading && (
                      <DropdownNavButton
                        text="More Options"
                        variant="small"
                        className="self-start bg-gray-500 hover:bg-gray-600 text-white rounded-md"
                        actions={[
                          ...(isFriend ? [{ label: "Remove Friend", onClick: onRemoveFriend }] : []),
                          { label: "Block", onClick: () => alert("Block clicked") },
                          { label: "Ignore", onClick: () => alert("Ignore clicked") },
                          { label: "Report", onClick: () => alert("Report clicked") },
                        ]}
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