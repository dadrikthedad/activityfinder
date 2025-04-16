// Siden hvor vi kan se venneforespørseler samt alle våre venner nedover
"use client";

import { useFriends } from "@/hooks/useFriends";
import { useFriendInvitations } from "@/hooks/useFriendInvitations";
import { useState } from "react";
import { fetchWithAuth } from "@/utils/api/fetchWithAuth";

export default function FriendsPage() {
  const { invitations, loading: loadingInvites } = useFriendInvitations();
  const { friends, loading: loadingFriends } = useFriends();
  const [handlingRequest, setHandlingRequest] = useState<number | null>(null);

  const respondToInvitation = async (id: number, action: "accept" | "decline") => {
    try {
      setHandlingRequest(id);
      await fetchWithAuth(`/api/friendinvitations/${id}/${action}`, {
        method: "PATCH",
      });
      // Refresh page (or better: re-fetch with SWR or state updates)
      location.reload(); // for simplicity now
    } catch (err) {
      console.error(`❌ Failed to ${action} invitation:`, err);
    } finally {
      setHandlingRequest(null);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-10 min-h-[85vh]">
      <h1 className="text-3xl font-bold mb-8">Venneliste</h1>

      {/* 🔔 Mottatte forespørsler */}
      <section className="mb-12">
        <h2 className="text-xl font-semibold mb-4">Venneforespørsler</h2>
        {loadingInvites ? (
          <p>Laster forespørsler...</p>
        ) : invitations.length === 0 ? (
          <p>Ingen forespørsler akkurat nå.</p>
        ) : (
          <ul className="space-y-4">
            {invitations.map((invite) => (
              <li
                key={invite.id}
                className="flex justify-between items-center bg-gray-100 dark:bg-gray-800 p-4 rounded"
              >
                <span>Forespørsel fra bruker-ID: {invite.senderId}</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => respondToInvitation(invite.id, "accept")}
                    disabled={handlingRequest === invite.id}
                    className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded"
                  >
                    Godta
                  </button>
                  <button
                    onClick={() => respondToInvitation(invite.id, "decline")}
                    disabled={handlingRequest === invite.id}
                    className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded"
                  >
                    Avslå
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 👥 Venneliste */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Dine venner</h2>
        {loadingFriends ? (
          <p>Laster venner...</p>
        ) : friends.length === 0 ? (
          <p>Du har ingen venner enda 😢</p>
        ) : (
          <ul className="space-y-3">
            {friends.map((friend) => (
              <li
                key={friend.friendId}
                className="bg-gray-50 dark:bg-gray-900 p-4 rounded border"
              >
                👤 Bruker-ID: {friend.friendId} — Score:{" "}
                {friend.userToFriendUserScore} /{" "}
                {friend.friendUserToUserScore}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
