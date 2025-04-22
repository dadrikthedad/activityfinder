"use client";
// Vennelisten på friends siden, sjekker først antall venner samt at den viser antall dager vedkommende har vært venner. Vi har også dropdownen med flrer options
import { useFriends } from "@/hooks/useFriends";
import UserActionPopover from "@/components/common/UserActionPopover";
import Card from "@/components/common/Card";
import ProfileNavButton from "@/components/settings/ProfileNavButton";
import DropdownProfileNavButton from "@/components/DropdownNavButton";
import { useEffect, useState } from "react";
import { useConfirmRemoveFriend } from "@/hooks/useConfirmRemoveFriend";

export default function FriendList() {
  const { friends, loading } = useFriends();
  const [searchTerm, setSearchTerm] = useState("");
  const [filteredFriends, setFilteredFriends] = useState(friends);
  const { confirmAndRemove } = useConfirmRemoveFriend();
//Her iterere vi over hver venn og legger det til en venneliste. Og da når vi sletter en venn så fjernes den i UI-en samt backend
  useEffect(() => {
    setFilteredFriends(
      friends.filter((friend) =>
        friend.friend.fullName.toLowerCase().includes(searchTerm.toLowerCase())
      )
    );
  }, [searchTerm, friends]);

  if (loading) return <p>Loading friends...</p>;
  if (friends.length === 0) return <p>You have no friends yet</p>;

  return (
    <>
    <div className="mb-6">
        <input
          type="text"
          placeholder="Search friends..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full p-3 border-2 border-[#1C6B1C] rounded-lg bg-white dark:bg-[#1e2122] text-black dark:text-white text-center"
        />
      </div>

    <ul className="space-y-6">
      {filteredFriends.map((friend) => (
        <li key={friend.friend.id}>
          <Card className="flex justify-between items-center gap-6 w-full p-6 border-2 border-[#1C6B1C]">
            <div className="flex items-center gap-4 w-full">
            <UserActionPopover
              user={friend.friend}
              onRemoveSuccess={() =>
                setFilteredFriends((prev) => prev.filter((f) => f.friend.id !== friend.friend.id))
              }
            />
              <div>
                <p className="text-lg font-semibold">{friend.friend.fullName}</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {(() => {
                    const days = Math.floor(
                      (new Date().getTime() - new Date(friend.createdAt).getTime()) /
                      (1000 * 60 * 60 * 24)
                    );
                    return days === 0
                      ? "You became friends today"
                      : `You have been friends for ${days} day${days > 1 ? "s" : ""}`;
                  })()}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <ProfileNavButton
                href={`/profile/${friend.friend.id}`}
                text="View Profile"
                variant="usual"
                className="bg-[#1C6B1C] hover:bg-[#0F3D0F] text-white"
              />
              <DropdownProfileNavButton
                text="More Options"
                variant="usual"
                actions={[
                  {
                    label: "Remove Friend",
                    onClick: () =>
                      confirmAndRemove(friend.friend.id, friend.friend.fullName, () => {
                        setFilteredFriends((prev) => prev.filter((f) => f.friend.id !== friend.friend.id));
                      }),
                  },
                  { label: "Block", onClick: () => alert("Block clicked") },
                  { label: "Ignore", onClick: () => alert("Ignore clicked") },
                  { label: "Report", onClick: () => alert("Report clicked") },
                ]}
              />
            </div>
          </Card>
        </li>
      ))}
    </ul>
    </>
  );
}