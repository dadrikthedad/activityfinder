// Denne vennelisten er synlig på en brukers profil hvis man er venn med brukeren enn så lenge. Brukes i profile/[id]. 
"use client";

import { useState, useEffect } from "react";
import { useFriendsOfUser } from "@/hooks/useFriendsOfUser";
import FriendListItem from "@/components/friends/FriendListItem";

export default function PublicSimpleFriendList({ userId }: { userId: number }) {
  const { friends, loading } = useFriendsOfUser(userId);
  const [friendList, setFriendList] = useState(friends);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    setFriendList(friends);
  }, [friends]);

  const filteredFriends = friendList.filter((friend) =>
    friend.friend.fullName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return <p>Loading friends...</p>;
  if (friends.length === 0) return <p className="text-center">No friends found</p>;

  return (
    <div className="relative bg-white dark:bg-[#1e2122] rounded-lg shadow-md p-4 max-h-[400px] overflow-y-auto border-2 border-[#1C6B1C] space-y-4">
      <input
        type="text"
        placeholder="Search friends..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="w-full p-3 py-3 border-2 border-[#1C6B1C] rounded-lg bg-white dark:bg-[#1e2122] text-black dark:text-white text-center"
      />

<ul className="space-y-4">
  {filteredFriends.map((friend) => (
    <FriendListItem key={friend.friend.id} friend={friend} />
  ))}
</ul>
    </div>
  );
}
