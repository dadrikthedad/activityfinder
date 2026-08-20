import { fetchWithAuth } from "@/utils/api/fetchWithAuthNative";
import { API_BASE_URL } from "@/constants/routes";
import { UserSummaryDTO } from "@shared/types/UserSummaryDTO";

export async function searchUsersForGroupInvite(query: string, conversationId: number): Promise<UserSummaryDTO[]> {
  const url = `${API_BASE_URL}/api/user/search/group-invite/${conversationId}?query=${encodeURIComponent(query)}`;
  try {
    const data = await fetchWithAuth<UserSummaryDTO[]>(url);
    return data || [];
  } catch (error) {
    console.error("Error searching users for group invite:", error);
    return [];
  }
}
