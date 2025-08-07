// brukes til å sjekke om vi er en venn med brukeren sin side vi besøker, bruker backend sin FriendsWith fra FriendsController.cs
import { fetchWithAuth } from "@/utils/api/fetchWithAuth.native";
import { API_BASE_URL } from "@/constants/routes";


export async function isFriendWith(otherUserId: number, token: string): Promise<boolean> {
    const url = `${API_BASE_URL}/api/friends/is-friend-with/${otherUserId}`;
  
    try {
      const data = await fetchWithAuth<{ isFriend: boolean }>(url, { method: "GET" }, token);
  
      if (!data) {
        console.warn("⚠️ Received null/undefined response from isFriendWith");
        return false;
      }
  
      return data.isFriend;
    } catch (error) {
      console.error("❌ Failed to check friendship status:", error);
      return false; // fallback
    }
  }