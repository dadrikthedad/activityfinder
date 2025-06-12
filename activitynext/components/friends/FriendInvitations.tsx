// Dette er venneinvitasjonsdelen på friends siden. Håndterer iterasjonen over listen med venneforespørsler. TODO: Må begrense den senere til kun 10 forespørsler per side, kanskje.
// Henter venneforespørsler fra backened og det er her vi kan godta og avslå den
"use client";
import { useFriendRequestHandler } from "@/hooks/friends/useFriendInvitationsHandler";
import FriendRequestButtons from "./FriendRequestButtons";
import UserActionPopover from "@/components/common/UserActionPopover";
import Card from "@/components/common/Card";
import { useFriendInvitations } from "@/hooks/useFriendInvitations";

import ProfileNavButton from "../settings/ProfileNavButton";
import Spinner from "../common/Spinner";

export default function FriendInvitations() {
  /* ---------- data fra zustand ---------- */

    const {
      invitations,
      loadMore,
      hasMore,
      loadingMore,
      loading
    } = useFriendInvitations();





  /* ---------- API-kall + lokal oppdatering ---------- */
  const { handleResponse, handlingId } = useFriendRequestHandler();

  /* ---------- tom- / laste-tilstand ---------- */
  const isLoadingInitial = loading;

  if (isLoadingInitial)
  return (
    <div className="py-10 flex justify-center">
      <Spinner size={40} borderSize={4} text="Loading friendrequests..." />
    </div>
  );
  if (invitations.length === 0) return null;


  /* ---------- render ---------- */
  return (
    <section className="w-full px-8 mt-12">
      <h2 className="text-xl font-semibold mb-4 text-[#1C6B1C]">
        Friend requests
      </h2>

      <ul className="space-y-6">
        {invitations.map((invite) => (
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

        {hasMore && (
        <div className="mt-6 text-center">
          <ProfileNavButton
            text={
              loadingMore ? (
                <Spinner size={20} borderSize={3} />
              ) : (
                "Show more friend requests"
              )
            }
            onClick={loadMore}
            disabled={loadingMore}
            variant="long"
          />
        </div>
      )}


    </section>
  );
}