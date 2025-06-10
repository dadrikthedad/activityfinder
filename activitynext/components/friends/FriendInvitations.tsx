// Dette er venneinvitasjonsdelen på friends siden. Håndterer iterasjonen over listen med venneforespørsler. TODO: Må begrense den senere til kun 10 forespørsler per side, kanskje.
// Henter venneforespørsler fra backened og det er her vi kan godta og avslå den
"use client";
import { useNotificationStore } from "@/store/useNotificationStore";
import { useState } from "react";
import ProfileNavButton from "@/components/settings/ProfileNavButton";
import { respondToInvitation } from "@/services/friendInvitations/respondToInvitation";
import UserActionPopover from "@/components/common/UserActionPopover";
import Card from "@/components/common/Card";
import { useAuth } from "@/context/AuthContext";

export default function FriendInvitations() {
  /* ---------- data fra zustand ---------- */
  const friendRequests = useNotificationStore((s) => s.friendRequests);
  const removeFriendRequest = useNotificationStore((s) => s.removeFriendRequest);
  const hasLoaded = useNotificationStore((s) => s.hasLoadedFriendRequests);

  /* ---------- øvrig UI-state ---------- */
  const { token } = useAuth();
  const [handlingId, setHandlingId] = useState<number | null>(null);


  /* ---------- API-kall + lokal oppdatering ---------- */
  const handleResponse = async (
    id: number,
    action: "accept" | "decline",
  ) => {
    if (!token) return;
    setHandlingId(id);
    try {
      await respondToInvitation(id, action, token); // backend
      removeFriendRequest(id);                      // zustand
      // Hvis du har badge-teller i navbaren er den allerede oppdatert nå
    } finally {
      setHandlingId(null);
    }
  };

  /* ---------- tom- / laste-tilstand ---------- */
  if (!hasLoaded) return <p>Loading requests...</p>;
  if (friendRequests.length === 0) return null;

  /* ---------- render ---------- */
  return (
    <section className="w-full px-8 mt-12">
      <h2 className="text-xl font-semibold mb-4 text-[#1C6B1C]">
        Friend requests
      </h2>

      <ul className="space-y-6">
        {friendRequests.map((invite) => (
          <li key={invite.id}>
            <Card className="flex justify-between items-center gap-6 w-full p-6">
              {invite.userSummary && (
                <span className="flex items-center gap-4 w-full">
                  <UserActionPopover
                    mode="standalone"
                    user={invite.userSummary}
                  />
                  <span className="text-lg font-semibold">
                    {invite.userSummary.fullName}
                  </span>{" "}
                  wants to be your friend!
                </span>
              )}

              <div className="flex gap-2">
                <ProfileNavButton
                  text="Accept"
                  onClick={() => handleResponse(invite.id, "accept")}
                  disabled={handlingId === invite.id}
                  variant="small"
                  className="bg-[#1C6B1C] hover:bg-[#0F3D0F] text-white"
                />
                <ProfileNavButton
                  text="Reject"
                  onClick={() => handleResponse(invite.id, "decline")}
                  disabled={handlingId === invite.id}
                  variant="small"
                  className="bg-gray-500 hover:bg-gray-600 text-white"
                />
              </div>
            </Card>
          </li>
        ))}
      </ul>
    </section>
  );
}