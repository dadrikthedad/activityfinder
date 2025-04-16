"use client";
import { useFriendInvitations } from "@/hooks/useFriendInvitations";
import { useState } from "react";
import ProfileNavButton from "@/components/settings/ProfileNavButton";
import { respondToInvitation } from "@/services/friendInvitations/respondToInvitation";
import UserActionPopover from "@/components/common/UserActionPopover";
import Card from "@/components/common/Card";

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
    <section className="w-full px-8 mt-12">
      <h2 className="text-xl font-semibold mb-4 text-[#1C6B1C]">Friend requests</h2>
      <ul className="space-y-6">
        {invitations.map((invite) => (
          <li key={invite.id}>
            <Card className="flex justify-between items-center gap-6 w-full p-6">
              {invite.userSummary && (
                <span className="flex items-center gap-4 w-full">
                  <UserActionPopover user={invite.userSummary}  />
                  <span className="text-lg font-semibold">
                    {invite.userSummary.fullName}
                    </span>{" "} wants to be your friend!
                </span>
              )}
              <div className="flex gap-2">
                <ProfileNavButton
                  text="Accept"
                  onClick={() => handleResponse(invite.id, "accept")}
                  disabled={handlingRequest === invite.id}
                  variant="small"
                  className="bg-[#1C6B1C] hover:bg-[#0F3D0F] text-white"
                />
                <ProfileNavButton
                  text="Reject"
                  onClick={() => handleResponse(invite.id, "decline")}
                  disabled={handlingRequest === invite.id}
                  variant="small"
                  className="bg-gray-500 hover:bg-gray-600 text-white font-semibold px-5 py-2 rounded text-sm"
                />
              </div>
            </Card>
          </li>
        ))}
      </ul>
    </section>
  );
}
