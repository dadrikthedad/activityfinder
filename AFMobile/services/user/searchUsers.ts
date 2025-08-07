// Her henter vi alle brukerens fullenavn fra backend slik at vi kan søke etter brukere i navbaren. Henter api fra UserController.cs
import { fetchWithAuth } from "@/utils/api/fetchWithAuth.native";
import { API_BASE_URL } from "@/constants/routes";
import { UserSummaryDTO } from "@shared/types/UserSummaryDTO";

// Erstatt begge fetch-kall med fetchWithAuth
export async function searchUsers(query: string): Promise<UserSummaryDTO[]> {
  const url = `${API_BASE_URL}/api/user/search?query=${encodeURIComponent(query)}`;
  try {
    const data = await fetchWithAuth<UserSummaryDTO[]>(url);
    return data || [];
  } catch (error) {
    console.error("❌ Error searching users:", error);
    return [];
  }
}

export async function searchUsersForGroupInvite(query: string, conversationId: number): Promise<UserSummaryDTO[]> {
  const url = `${API_BASE_URL}/api/user/search/group-invite/${conversationId}?query=${encodeURIComponent(query)}`;
  try {
    const data = await fetchWithAuth<UserSummaryDTO[]>(url);
    return data || [];
  } catch (error) {
    console.error("❌ Error searching users for group invite:", error);
    return [];
  }
}