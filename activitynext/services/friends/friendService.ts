// services/friendService.ts
import { fetchWithAuth } from "@/utils/api/fetchWithAuth";
import { FriendInvitationDTO } from "@/types/FriendInvitationDTO";
import { API_BASE_URL, API_ROUTES } from "@/constants/routes";

// Henter alle mottatte venneforespørsler
export async function getFriendInvitations(token: string): Promise<FriendInvitationDTO[]> {
  const url = `${API_BASE_URL}${API_ROUTES.friendInvitations.received}`;
  const data = await fetchWithAuth<FriendInvitationDTO[]>(url, {}, token);
  return data ?? [];
}

export async function getFriendInvitationById(id: number, token: string) {
  const url = `${API_BASE_URL}/friend-invitations/${id}`;
  return await fetchWithAuth<FriendInvitationDTO>(url, {}, token);
}