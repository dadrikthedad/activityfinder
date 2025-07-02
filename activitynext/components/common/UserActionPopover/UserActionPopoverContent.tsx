// UserActionPopoverContent.tsx - Updated to handle nested send message
import EnlargeableImage from "@/components/common/EnlargeableImage";
import { UserSummaryDTO } from "@/types/UserSummaryDTO";
import ProfileNavButton from "../../settings/ProfileNavButton";
import DropdownNavButton from "../../DropdownNavButton";
import ParticipantsDropdownButton from "./UserActionParticipantDropdown";
import { useChatStore } from "@/store/useChatStore";

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
  conversationId?: number;
  //Handler for send message from nested context
  onSendMessageFromNested?: (user: UserSummaryDTO) => void;
  // Handler for opening invite users window
  onOpenInviteWindow?: (conversationId?: number, participants?: UserSummaryDTO[]) => void;
  isLeavingGroup?: boolean;
  groupImageUrl?: string | null;
  uploadingImage?: boolean;
  uploadError?: string | null;
  onImageUpload?: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onTriggerImageUpload?: () => void;
    // Group name props
  isEditingGroupName?: boolean;
  tempGroupName?: string;
  updatingGroupName?: boolean;
  onStartEditGroupName?: () => void;
  onCancelEditGroupName?: () => void;
  onSaveGroupName?: () => void;
  onSetTempGroupName?: (name: string) => void;
  groupNameError?: string | null;
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
  onSendMessageFromNested,
  onOpenInviteWindow,
  isLeavingGroup,
  conversationId, 
  // New group image props
  groupImageUrl,
  uploadingImage,
  uploadError,
  onImageUpload,
  onTriggerImageUpload,
  isEditingGroupName,
  tempGroupName,
  updatingGroupName,
  onStartEditGroupName,
  onCancelEditGroupName,
  onSaveGroupName,
  onSetTempGroupName,
  groupNameError,
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
  
  // Handler for showing user popover - should NOT automatically send message
  const handleShowUserPopover = (targetUser: UserSummaryDTO, event: React.MouseEvent) => {
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
              src={groupImageUrl || user.profileImageUrl || (isGroup ? "/default-group.png" : "/default-avatar.png")}
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

                {/* Hidden file input for image upload - only show if NOT pending */}
                {!isPendingRequest && (
                  <input
                    id="group-image-upload-popover"
                    type="file"
                    accept="image/*"
                    onChange={onImageUpload}
                    className="hidden"
                    disabled={uploadingImage}
                  />
                )}

                {/* Change Image button - only show if NOT pending */}
                {!isPendingRequest && (
                  <ProfileNavButton
                    text={uploadingImage ? "Uploading..." : "Change Image"}
                    onClick={onTriggerImageUpload || (() => {})}
                    variant="small"
                    className="bg-[#1C6B1C] hover:bg-[#0F3D0F] text-white"
                    disabled={uploadingImage}
                  />
                )}

                {uploadError && !isPendingRequest && (
                    <p className="text-red-500 text-xs mt-2">{uploadError}</p>
                  )}


                  {/* Group name editing */}
                  {!isPendingRequest && (
                    <>
                      {isEditingGroupName ? (
                        <div className="space-y-2 w-full">
                          <input
                            type="text"
                            value={tempGroupName}
                            onChange={(e) => onSetTempGroupName?.(e.target.value)}
                            placeholder="Enter group name"
                            maxLength={100}
                            className="w-full p-2 border-1 rounded dark:bg-[#1e2122] dark:border-[#1C6B1C] focus:outline-none text-sm"
                            disabled={updatingGroupName}
                            autoFocus
                          />
                          <div className="flex gap-2">
                            <ProfileNavButton
                              text={updatingGroupName ? "Saving..." : "Save"}
                              onClick={onSaveGroupName || (() => {})}
                              variant="small"
                              className="bg-[#1C6B1C] hover:bg-[#0F3D0F] text-white flex-1"
                              disabled={updatingGroupName || !tempGroupName?.trim()}
                            />
                            <ProfileNavButton
                              text="Cancel"
                              onClick={onCancelEditGroupName || (() => {})}
                              variant="small"
                              className="bg-gray-500 hover:bg-gray-600 text-white flex-1"
                              disabled={updatingGroupName}
                            />
                          </div>
                          {groupNameError && (
                            <p className="text-red-500 text-xs mt-2">{groupNameError}</p>
                          )}
                        </div>
                      ) : (
                        <ProfileNavButton
                          text="Change Name"
                          onClick={onStartEditGroupName || (() => {})}
                          variant="small"
                          className="bg-[#1C6B1C] hover:bg-[#0F3D0F] text-white"
                        />
                      )}
                    </>
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