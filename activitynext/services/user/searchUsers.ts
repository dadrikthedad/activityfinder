// Her henter vi alle brukerens fullenavn fra backend slik at vi kan søke etter brukere i navbaren. Henter api fra UserController.cs
import { UserSummaryDTO } from "@/types/FriendInvitationDTO";
import { API_BASE_URL } from "@/constants/routes";

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
