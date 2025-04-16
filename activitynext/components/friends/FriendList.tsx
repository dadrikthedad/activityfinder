"use client";
import { useFriends } from "@/hooks/useFriends";

export default function FriendList() {
  const { friends, loading } = useFriends();

  if (loading) return <p>Laster venner...</p>;
  if (friends.length === 0) return <p>Du har ingen venner enda 😢</p>;

  return (
    <ul className="space-y-3">
      {friends.map((friend) => (
        <li
          key={friend.friendId}
          className="bg-gray-50 dark:bg-gray-900 p-4 rounded border text-left"
        >
          👤 Bruker-ID: {friend.friendId} — Score: {friend.userToFriendUserScore} / {friend.friendUserToUserScore}
        </li>
      ))}
    </ul>
  );
}