// Brukes til metoden DELETE i backend, brukes til å slette en venn
import { fetchWithAuth } from "@/utils/api/fetchWithAuth.native";
import { API_BASE_URL } from "@/constants/routes";

export async function removeFriend(friendId: number, token: string): Promise<void> {
  const url = `${API_BASE_URL}/api/friends/${friendId}`;
  try {
    await fetchWithAuth(url, { method: "DELETE" }, token);
  } catch (error) {
    console.error("❌ Failed to remove friend:", error);
    throw error;
  }
}