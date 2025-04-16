"use client";
import { Popover } from "@headlessui/react";
import ProfileNavButton from "../settings/ProfileNavButton";
import MiniAvatar from "./MiniAvatar";
import { UserSummaryDTO } from "@/types/FriendInvitationDTO";
import EnlargeableImage from "@/components/common/EnlargeableImage";

interface Props {
  user: UserSummaryDTO;
  avatarSize?: number;
}

export default function UserActionPopover({ user, avatarSize = 120 }: Props) {
    return (
      <Popover className="relative inline-block text-left">
        <Popover.Button>
          <MiniAvatar
            imageUrl={user.profileImageUrl ?? "/default-avatar.png"}
            size={avatarSize}
          />
        </Popover.Button>
  
        <Popover.Panel className="absolute z-20 mt-2 w-96 right-0 bg-white dark:bg-[#1e2122] shadow-md rounded-xl p-6 border border-gray-200 dark:border-zinc-700 p-4">
          <div className="flex justify-between items-start gap-4">
            {/* VENSTRE SIDE: Større avatar og navn under */}
            <div className="flex flex-col items-center">
            <EnlargeableImage
                src={user.profileImageUrl ?? "/default-avatar.png"}
                size={150}
                />
              <p className="mt-2 font-semibold text-center">{user.fullName}</p>
            </div>
  
            {/* HØYRE SIDE: Handlinger */}
            <ul className="text-sm space-y-2 text-right self-center">
            <ProfileNavButton
                href={`/profile/${user.id}`}
                text="Visit Profile"
                variant="small"
                className="bg-[#1C6B1C] hover:bg-[#0F3D0F] text-white"
                />

                <ProfileNavButton
                text="Send Message"
                onClick={() => alert("Coming soon!")}
                variant="small"
                className="bg-[#1C6B1C] hover:bg-[#0F3D0F] text-white"
                />

                <ProfileNavButton
                text="Ignore"
                onClick={() => alert("Coming soon!")}
                variant="small"
                className="bg-gray-500 hover:bg-gray-600 text-white"
                />

                <ProfileNavButton
                text="Block User"
                onClick={() => alert("Coming soon!")}
                variant="small"
                className="bg-gray-500 hover:bg-gray-600 text-white"
                />
            </ul>
          </div>
        </Popover.Panel>
      </Popover>
    );
  }