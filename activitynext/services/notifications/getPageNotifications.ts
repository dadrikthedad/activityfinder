// Denne brukes til å hente 100 notifications som skal vises på /notifications
import { fetchWithAuth } from "@/utils/api/fetchWithAuth";
import { API_BASE_URL, API_ROUTES } from "@/constants/routes";
import { NotificationDTO } from "@/types/NotificationEventDTO";

export async function getPageNotifications(token: string): Promise<NotificationDTO[]> {
  const url = `${API_BASE_URL}${API_ROUTES.notifications.page}`;

  try {
    const response = await fetchWithAuth(url, { method: "GET" }, token) as Response;
    const data = await response.json() as NotificationDTO[];
    return data;
  } catch (err) {
    console.error("❌ Failed to load page notifications:", err);
    throw err;
  }
}