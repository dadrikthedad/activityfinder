// Dette er venneinvitasjonsdelen på friends siden. Håndterer iterasjonen over listen med venneforespørsler. TODO: Må begrense den senere til kun 10 forespørsler per side, kanskje.
// Henter venneforespørsler fra backened og det er her vi kan godta og avslå den
"use client";
import { useNotificationStore } from "@/store/useNotificationStore";
import { useFriendRequestHandler } from "@/hooks/friends/useFriendInvitationsHandler";
import FriendRequestButtons from "./FriendRequestButtons";
import UserActionPopover from "@/components/common/UserActionPopover";
import Card from "@/components/common/Card";

export default function FriendInvitations() {
  /* ---------- data fra zustand ---------- */
  const friendRequests = useNotificationStore((s) => s.friendRequests);
  const hasLoaded = useNotificationStore((s) => s.hasLoadedFriendRequests);

  /* ---------- API-kall + lokal oppdatering ---------- */
  const { handleResponse, handlingId } = useFriendRequestHandler();

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
                <FriendRequestButtons
                  requestId={invite.id}
                  isLoading={handlingId === invite.id}
                  onRespond={handleResponse}
                  variant="text"
                  size="small"
                />
              </div>
            </Card>
          </li>
        ))}
      </ul>
    </section>
  );
}