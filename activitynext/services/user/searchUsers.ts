// Her henter vi alle brukerens fullenavn fra backend slik at vi kan søke etter brukere i navbaren. Henter api fra UserController.cs
import { UserSummaryDTO } from "@shared/types/UserSummaryDTO";
import { API_BASE_URL } from "@/constants/api/routes";

export async function searchUsers(query: string): Promise<UserSummaryDTO[]> {
  const url = `${API_BASE_URL}/api/user/search?query=${encodeURIComponent(query)}`;

  try {
    const data = await fetch(url); // eller fetchWithAuth hvis det trengs
    if (!data.ok) throw new Error("Failed to fetch users");
    return await data.json();
  } catch (error) {
    console.error("❌ Error searching users:", error);
    return [];
  }
}

export async function searchUsersForGroupInvite(query: string, conversationId: number): Promise<UserSummaryDTO[]> {
  const url = `${API_BASE_URL}/api/user/search/group-invite/${conversationId}?query=${encodeURIComponent(query)}`;
  try {
    const data = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`, // Trengs for tilgangssjekk
      },
    });
    if (!data.ok) throw new Error("Failed to fetch users for group invite");
    return await data.json();
  } catch (error) {
    console.error("❌ Error searching users for group invite:", error);
    return [];
  }
}
