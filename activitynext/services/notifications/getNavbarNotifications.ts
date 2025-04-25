// Denne brukes til å hente 15 notifications som vises da i navbaren
import { fetchWithAuth } from "@/utils/api/fetchWithAuth";
import { API_BASE_URL, API_ROUTES } from "@/constants/routes";
import { NotificationDTO } from "@/types/NotificationEventDTO";

export async function getNavbarNotifications(token: string): Promise<NotificationDTO[]> {
  const url = `${API_BASE_URL}${API_ROUTES.notifications.navbar}`;

  try {
    const response = await fetchWithAuth(url, { method: "GET" }, token) as Response;
    const data = await response.json() as NotificationDTO[];
    return data;
  } catch (err) {
    console.error("❌ Failed to load navbar notifications:", err);
    throw err;
  }
}
