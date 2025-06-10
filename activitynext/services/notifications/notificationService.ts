// services/notifications/getNotificationById.ts
import { fetchWithAuth } from "@/utils/api/fetchWithAuth";
import { NotificationDTO } from "@/types/NotificationEventDTO";
import { API_BASE_URL } from "@/constants/routes";

export async function getNotificationById(id: number, token: string) {
  const url = `${API_BASE_URL}/notifications/${id}`;
  return await fetchWithAuth<NotificationDTO>(url, {}, token);
}