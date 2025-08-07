// services/friendService.ts
import { fetchWithAuth } from "@/utils/api/fetchWithAuth";
import { FriendInvitationDTO, PaginatedFriendInvResponse  } from "@shared/types/FriendInvitationDTO";
import { API_BASE_URL, API_ROUTES } from "@/constants/api/routes";

// Henter alle mottatte venneforespørsler
export async function getFriendInvitations(
  token: string,
  pageNumber = 1,
  pageSize = 10
): Promise<PaginatedFriendInvResponse<FriendInvitationDTO>> {
  const url = `${API_BASE_URL}${API_ROUTES.friendInvitations.received}?pageNumber=${pageNumber}&pageSize=${pageSize}`;
  const data = await fetchWithAuth<PaginatedFriendInvResponse<FriendInvitationDTO>>(url, {}, token);
  return data ?? { totalCount: 0, pageNumber, pageSize, data: [] };
}

export async function getFriendInvitationById(id: number, token: string) {
  const url = `${API_BASE_URL}/api/friendinvitations/${id}`;
  return await fetchWithAuth<FriendInvitationDTO>(url, {}, token);
}