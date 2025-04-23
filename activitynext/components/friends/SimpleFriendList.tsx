// En simpel utgave av venne listen for å se alle vennene, brukes på egen profil side. Skal implimentere en egen for å se en annens venneliste
"use client";

import { useFriends } from "@/hooks/useFriends";
import UserActionPopover from "@/components/common/UserActionPopover";
import ProfileNavButton from "@/components/settings/ProfileNavButton";
import { useState, useEffect } from "react";

export default function SimpleFriendList() {
  const { friends, loading } = useFriends();
  const [friendList, setFriendList] = useState(friends);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    setFriendList(friends);
  }, [friends]);


  const filteredFriends = friendList.filter((friend) =>
    friend.friend.fullName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return <p>Loading friends...</p>;
  if (friends.length === 0) return <p className="text-center" >No friends found</p>;

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
          <li key={friend.friend.id} className="flex items-center gap-4">
            <UserActionPopover user={friend.friend} avatarSize={60} onRemoveSuccess={() =>
    setFriendList((prev) => prev.filter((f) => f.friend.id !== friend.friend.id)) } />
            <span className="text-md font-medium">{friend.friend.fullName}</span>
          </li>
        ))}
      </ul>
        
      <div className="flex justify-center pt-2">
        <ProfileNavButton
          href="/friends"
          text="See All Friends"
          variant="usual"
          className="bg-[#1C6B1C] hover:bg-[#0F3D0F] text-white"
        />
      </div>
      
    </div>
  );
}