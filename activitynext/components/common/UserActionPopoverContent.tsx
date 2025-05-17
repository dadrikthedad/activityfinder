// components/common/UserActionPopoverContent.tsx

import EnlargeableImage from "@/components/common/EnlargeableImage";
import { UserSummaryDTO } from "@/types/FriendInvitationDTO";
import ProfileNavButton from "../settings/ProfileNavButton";
import DropdownNavButton from "../DropdownNavButton";

interface Props {
  user: UserSummaryDTO;
  isOwner: boolean;
  isFriend: boolean;
  isFriendLoading: boolean;
  onVisitProfile: () => void;
  onSendMessage: () => void;
  onRemoveFriend: () => void;
  onClose: () => void;
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
}: Props) {
  return (
    <div className="w-96 bg-white dark:bg-[#1e2122] shadow-md rounded-xl p-6 border-2 border-[#1C6B1C]"
    onMouseDown={(e) => {
        e.stopPropagation();
        e.preventDefault();
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
            <EnlargeableImage src={user.profileImageUrl ?? "/default-avatar.png"} size={120} />
            <div className="w-full mt-2 text-center break-words max-w-[120px]">
              <p className="text-lg font-semibold">{user.fullName}</p>
            </div>
          </div>
          <div className="flex flex-col justify-center flex-1 items-start space-y-2">
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
          </div>
        </div>
      </div>
    </div>
  );
}
