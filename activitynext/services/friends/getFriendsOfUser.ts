import { fetchWithAuth } from "@/utils/api/fetchWithAuth";
import { API_BASE_URL } from "@/constants/routes";
import { FriendDTO } from "@/types/FriendDTO"; // Assuming you have a type for FriendDTO

export async function getFriendsOfUser(userId: number, token: string): Promise<FriendDTO[]> {
  const url = `${API_BASE_URL}/api/friends/of/${userId}`;

  try {
    const data = await fetchWithAuth<FriendDTO[]>(url, { method: "GET" }, token);

    if (!data) {
      console.warn("⚠️ Received null/undefined response from getFriendsOfUser");
      return [];
    }

    return data;
  } catch (error) {
    console.error("❌ Failed to fetch friends of user:", error);
    return [];
  }
}