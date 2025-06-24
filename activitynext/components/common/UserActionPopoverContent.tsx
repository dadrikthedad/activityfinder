// UserActionPopoverContent.tsx
import EnlargeableImage from "@/components/common/EnlargeableImage";
import { UserSummaryDTO } from "@/types/UserSummaryDTO";
import ProfileNavButton from "../settings/ProfileNavButton";
import DropdownNavButton from "../DropdownNavButton";
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
  // ✅ Nye props for grupper
  isGroup?: boolean;
  participants?: UserSummaryDTO[];
  onLeaveGroup?: () => void;
  onShowUserPopover?: (user: UserSummaryDTO, pos: { x: number; y: number }) => void;
  isPendingRequest?: boolean; 
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
}: Props) {
  return (
    <div className="w-96 bg-white dark:bg-[#1e2122] shadow-md rounded-xl p-6 border-2 border-[#1C6B1C]"
    onMouseDown={(e) => {
        // ✅ SMART PROPAGATION HANDLING
        const target = e.target as HTMLElement;
        
        // ✅ LA VÆRE å stoppe propagation for:
        // - Dropdowns (data-dropdown-id)
        // - Interactive buttons/inputs
        // - Nested popovers
        if (
          target.closest('[data-dropdown-id]') ||
          target.closest('button') ||
          target.closest('input') ||
          target.closest('[data-nested-user-popover]') ||
          target.closest('[data-nested-popover]')
        ) {
          return; // La event propagere
        }
        
        // ✅ Kun stopp propagation for klikk på selve popover-bakgrunnen
        e.stopPropagation();
      }}>
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
                {/* ✅ Bruk din ParticipantsDropdownButton i stedet for DropdownNavButton */}
                {onShowUserPopover && (
                  <ParticipantsDropdownButton
                    participants={participants}
                    onShowUserPopover={onShowUserPopover}
                    className="self-start"
                  />
                )}
                
                {/* Leave Group knapp - bare vis hvis onLeaveGroup finnes */}
                 {/* Leave Group knapp - bare vis hvis IKKE pending request */}
                  {onLeaveGroup && !isPendingRequest && ( // ✅ Legg til !isPendingRequest check
                    <ProfileNavButton
                      text="Leave Group"
                      onClick={onLeaveGroup}
                      variant="small"
                      className="bg-gray-500 hover:bg-gray-600 text-white"
                    />
                  )}
              </>
            ) : (
              /* Eksisterende individuelle bruker-knapper */
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