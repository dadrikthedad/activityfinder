import { fetchWithAuth } from "@/utils/api/fetchWithAuth";
import { API_ROUTES } from "@/constants/routes";

export async function respondToInvitation(id: number, action: "accept" | "decline") {
  try {
    await fetchWithAuth(`${API_ROUTES.friendInvitations[action](id)}`, {
      method: "PATCH",
    });
  } catch (err) {
    console.error(`❌ Failed to ${action} invitation:`, err);
    throw err;
  }
}
