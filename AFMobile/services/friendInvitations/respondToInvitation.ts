// AFMobile/services/friendInvitationService.ts
// Her skal vi håndtere om vi godkjenner eller avslår venneforespørsel, ikke ferdig enda
import { fetchWithAuth } from "@/utils/api/fetchWithAuth.native";
import { API_BASE_URL } from "@/constants/routes";
import { API_ROUTES, APP_ROUTES } from "@shared/constants/routes";

type FriendInvitationResponse = {
  message: string;
  conversationId: number | null;
};

export async function respondToInvitation(
  id: number,
  action: "accept" | "decline",
  token: string
) {
  const url = `${API_BASE_URL}${API_ROUTES.friendInvitations[action](id)}`;
  const data = await fetchWithAuth<FriendInvitationResponse>(url, { method: "PATCH" }, token);
  return data?.conversationId ?? null;
}