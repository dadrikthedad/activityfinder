// Her henter vi MarkAllAsRead fra backend og leser de slik at brukeren sin notifiations ikon forsvinner
import { fetchWithAuth } from "@/utils/api/fetchWithAuth";
import { API_BASE_URL, API_ROUTES } from "@/constants/routes";

// Typen vi får fra backend slik at vi kan se antall notifications lest
type MarkAllAsReadResponse = {
    message: string;
    updatedCount: number;
  };

export async function markAllNotificationsAsRead(token: string) {
  const url = `${API_BASE_URL}${API_ROUTES.notifications.markAllAsRead}`;

  try {
    const response = await fetchWithAuth(url, {
      method: "POST",
    }, token) as Response;

    const data = await response.json() as MarkAllAsReadResponse;
    console.log("🔔 Notifications marked as read:", data);
    return data;
  } catch (err) {
    console.error("❌ Failed to mark notifications as read:", err);
    throw err;
  }
}