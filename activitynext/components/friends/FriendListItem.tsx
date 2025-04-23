// Her representere vi en venn i iterasjonen av vennelista. Den tar inn et venneobjekt FriendDTO og viser vennens navn og profilbilde gjennom UserActionPopover. Med useFriendWith
// så kan vi sjekke om vår innloggede bruker er venn med brukeren fra en annens venneliste.
"use client";
import { useFriendWith } from "@/hooks/useFriendWith";
import UserActionPopover from "@/components/common/UserActionPopover";
import { FriendDTO } from "@/types/FriendDTO";

export default function FriendListItem({ friend }: { friend: FriendDTO }) {
  const { isFriend, loading } = useFriendWith(friend.friend.id);

  return (
    <li className="flex items-center gap-4">
      <UserActionPopover user={friend.friend} avatarSize={60} />
      <div>
        <span className="text-md font-medium">{friend.friend.fullName}</span>
        {!loading && isFriend && (
          <span className="ml-2 text-sm text-green-600 font-semibold">(Friend)</span>
        )}
      </div>
    </li>
  );
}