// Denne brukes til å slette alle notifikasjoner til en enkelt bruker
import { fetchWithAuth } from "@/utils/api/fetchWithAuth.native";
import { API_BASE_URL } from "@/constants/routes";
import { API_ROUTES } from "@shared/constants/routes";

type DeleteAllResponse = {
  message: string;
  deletedCount: number;
};

export async function deleteAllNotifications(token: string): Promise<DeleteAllResponse> {
    const url = `${API_BASE_URL}${API_ROUTES.notifications.deleteAll}`;
  
    try {
      const data = await fetchWithAuth<DeleteAllResponse>(url, {
        method: "DELETE",
      }, token);
  
      if (!data) throw new Error("No data returned from server");
  
      return data;
    } catch (err) {
      console.error("❌ Failed to delete notifications:", err);
      throw err;
    }
  }