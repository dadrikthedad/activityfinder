// Her representere vi en venn i iterasjonen av vennelista. Den tar inn et venneobjekt FriendDTO og viser vennens navn og profilbilde gjennom UserActionPopover. Med useFriendWith
// så kan vi sjekke om vår innloggede bruker er venn med brukeren fra en annens venneliste.
"use client";
import ClickableAvatarNative from "@/components/common/UserActionPopover/ClickableAvatarNative"; // NY IMPORT
import { FriendDTO } from "@shared/types/FriendDTO";
import { useFriendWith } from "@/hooks/useFriendWith";

export default function FriendListItem({ friend }: { friend: FriendDTO }) {
  const { isFriend, loading } = useFriendWith(friend.friend.id);

  return (
    <li className="flex items-center gap-4">
      {/* NY: Bruk ClickableAvatar komponent */}
      <ClickableAvatarNative
        user={friend.friend}
        size={60}
      />
      
      <div>
        <span className="text-md font-medium">{friend.friend.fullName}</span>
        {!loading && isFriend && (
          <span className="ml-2 text-sm text-green-600 font-semibold">(Friend)</span>
        )}
      </div>
    </li>
  );
}