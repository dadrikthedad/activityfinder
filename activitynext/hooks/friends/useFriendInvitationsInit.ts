import { getFriendInvitations } from "@/services/friends/friendService";
import { useNotificationStore } from "@/store/useNotificationStore";

/**
 * Henter alle venneforespørsler for innlogget bruker og
 * legger dem i NotificationStore. Kalles bare hvis
 * `hasLoadedFriendRequests` er false.
 */
export async function fetchAndSetFriendRequests(token: string) {
  try {
    const response = await getFriendInvitations(token, 1, 10); // henter side 1 med 10 invitasjoner
    console.log("🤝 Friend requests fetched:", response.data.length);

    // legg i store
    const store = useNotificationStore.getState();
    store.setFriendRequests(response.data ?? []);
    store.setFriendRequestTotalCount(response.totalCount);
    store.setHasLoadedFriendRequests(true);
  } catch (err) {
    console.error("❌ Failed to load friend requests:", err);
  }
}