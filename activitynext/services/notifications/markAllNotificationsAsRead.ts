import { fetchWithAuth } from "@/utils/api/fetchWithAuth";
import { API_BASE_URL, API_ROUTES } from "@/constants/api/routes";

type MarkAllAsReadResponse = {
  message: string;
  updatedCount: number;
};

export async function markAllNotificationsAsRead(token: string) {
  const url = `${API_BASE_URL}${API_ROUTES.notifications.markAllAsRead}`;

  try {
    const data = await fetchWithAuth<MarkAllAsReadResponse>(url, {
      method: "POST",
    }, token);

    console.log("🔔 Notifications marked as read:", data);
    return data;
  } catch (err) {
    console.error("❌ Failed to mark notifications as read:", err);
    throw err;
  }
}