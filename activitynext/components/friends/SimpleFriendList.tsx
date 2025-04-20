// En simpel utgave av venne listen for å se alle vennene
"use client";

import { useFriends } from "@/hooks/useFriends";
import UserActionPopover from "@/components/common/UserActionPopover";

export default function SimpleFriendList() {
  const { friends, loading } = useFriends();

  if (loading) return <p>Loading friends...</p>;
  if (friends.length === 0) return <p>No friends found</p>;

  return (
    <div className="relative bg-white dark:bg-[#1e2122] rounded-lg shadow-md p-1 max-h-[400px] border-2 border-[#1C6B1C]">
      <ul className="space-y-4">
        {friends.map((friend) => (
          <li key={friend.friend.id} className="flex items-center gap-4">
            <UserActionPopover user={friend.friend} avatarSize={60} />
            <span className="text-md font-medium">{friend.friend.fullName}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}