// Denne brukes til å slette alle notifikasjoner til en enkelt bruker
import { fetchWithAuth } from "@/utils/api/fetchWithAuth";
import { API_BASE_URL, API_ROUTES } from "@/constants/routes";

type DeleteAllResponse = {
  message: string;
  deletedCount: number;
};

export async function deleteAllNotifications(token: string): Promise<DeleteAllResponse> {
  const url = `${API_BASE_URL}${API_ROUTES.notifications.deleteAll}`;

  try {
    const response = await fetchWithAuth(url, {
      method: "DELETE",
    }, token) as Response;

    const data = await response.json() as DeleteAllResponse;
    console.log("🗑️ Notifications deleted:", data);
    return data;
  } catch (err) {
    console.error("❌ Failed to delete notifications:", err);
    throw err;
  }
}
