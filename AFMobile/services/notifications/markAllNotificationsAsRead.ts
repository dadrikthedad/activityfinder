import { fetchWithAuth } from "@/utils/api/fetchWithAuth.native";
import { API_BASE_URL } from "@/constants/routes";
import { API_ROUTES } from "@shared/constants/routes";

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