"use client";
import { useFriendInvitations } from "@/hooks/useFriendInvitations";
import { useState } from "react";
import ProfileNavButton from "@/components/settings/ProfileNavButton";
import { respondToInvitation } from "@/services/friendInvitations/respondToInvitation";

export default function FriendInvitations() {
  const { invitations, loading } = useFriendInvitations();
  const [handlingRequest, setHandlingRequest] = useState<number | null>(null);

  const handleResponse = async (id: number, action: "accept" | "decline") => {
    try {
      setHandlingRequest(id);
      await respondToInvitation(id, action);
      location.reload(); // ev. SWR senere
    } finally {
      setHandlingRequest(null);
    }
  };

  if (loading) return <p>Loading requests...</p>;
  if (invitations.length === 0) return null;

  return (
    <section className="w-full max-w-2xl mt-10">
      <h2 className="text-xl font-semibold mb-4 text-[#1C6B1C]">Friend requests</h2>
      <ul className="space-y-4">
        {invitations.map((invite) => (
          <li
            key={invite.id}
            className="flex justify-between items-center bg-gray-100 dark:bg-gray-800 p-4 rounded"
          >
            <span>{invite.senderFullName} wants to be your friend!</span>
            <div className="flex gap-2">
              <ProfileNavButton
                text="Godta"
                onClick={() => handleResponse(invite.id, "accept")}
                disabled={handlingRequest === invite.id}
                variant="small"
                className="bg-green-600 hover:bg-green-700 text-white"
              />
              <ProfileNavButton
                text="Avslå"
                onClick={() => handleResponse(invite.id, "decline")}
                disabled={handlingRequest === invite.id}
                variant="small"
                className="bg-red-600 hover:bg-red-700 text-white"
              />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
