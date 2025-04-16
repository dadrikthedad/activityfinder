"use client";
import { useFriends } from "@/hooks/useFriends";
import MiniAvatar from "@/components/common/MiniAvatar";
import Link from "next/link";

export default function FriendList() {
  const { friends, loading } = useFriends();

  if (loading) return <p>Laster venner...</p>;
  if (friends.length === 0) return <p>Du har ingen venner enda 😢</p>;

  return (
    <ul className="space-y-3">
      {friends.map((friend) => (
        <li
          key={friend.friend.id}
          className="flex items-center gap-4 bg-gray-50 dark:bg-gray-900 p-4 rounded border"
        >
          <MiniAvatar imageUrl={friend.friend.profileImageUrl ?? "/default-profile.png"} />
          <div>
            <Link href={`/profile/${friend.friend.id}`} className="text-lg font-semibold hover:underline">
              {friend.friend.fullName}
            </Link>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Score: {friend.userToFriendUserScore} / {friend.friendUserToUserScore}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}