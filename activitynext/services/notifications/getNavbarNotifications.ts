// Denne brukes til å hente 15 notifications som vises da i navbaren
import { fetchWithAuth } from "@/utils/api/fetchWithAuth";
import { API_BASE_URL, API_ROUTES } from "@/constants/routes";
import { NotificationDTO } from "@/types/NotificationEventDTO";

export async function getNavbarNotifications(token: string): Promise<NotificationDTO[]> {
  const url = `${API_BASE_URL}${API_ROUTES.notifications.navbar}`;

  try {
    const data = await fetchWithAuth<NotificationDTO[]>(url, {
      method: "GET",
    }, token, "basic");

    if (!data) {
      console.warn("⚠️ Ingen notifications data mottatt fra server.");
      return [];
    }

    console.log("🔔 Notifications hentet:", data);
    return data ?? [];
  } catch (err) {
    console.error("❌ Feil ved henting av notifications:", err);
    throw err;
  }
}