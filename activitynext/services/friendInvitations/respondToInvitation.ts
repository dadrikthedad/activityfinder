// Her skal vi håndtere om vi godkjenner eller avslår venneforespørsel, ikke ferdig enda
import { fetchWithAuth } from "@/utils/api/fetchWithAuth";
import { API_ROUTES, API_BASE_URL } from "@/constants/routes";

export async function respondToInvitation(
  id: number,
  action: "accept" | "decline",
  token: string
) {
  const url = `${API_BASE_URL}${API_ROUTES.friendInvitations[action](id)}`;

  try {
    await fetchWithAuth(url, {
      method: "PATCH",
    }, token);
  } catch (err) {
    console.error(`❌ Failed to ${action} invitation:`, err);
    throw err;
  }
}