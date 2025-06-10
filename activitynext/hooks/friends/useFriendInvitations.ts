import { getFriendInvitations } from "@/services/friends/friendService";
import { useNotificationStore } from "@/store/useNotificationStore";

/**
 * Henter alle venneforespørsler for innlogget bruker og
 * legger dem i NotificationStore. Kalles bare hvis
 * `hasLoadedFriendRequests` er false.
 */
export async function fetchAndSetFriendRequests(token: string) {
  try {
    const data = await getFriendInvitations(token);
    console.log("🤝 Friend requests fetched:", data?.length ?? 0);

    // legg i store
    const store = useNotificationStore.getState();
    store.setFriendRequests(data ?? []);
    store.setHasLoadedFriendRequests(true);
  } catch (err) {
    console.error("❌ Failed to load friend requests:", err);
  }
}