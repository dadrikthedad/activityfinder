import { getRequest } from "@/services/baseService";
import { API_BASE_URL } from "@/constants/routes";
import { NotificationDTO } from "@shared/types/NotificationEventDTO";

export async function getNotifications(
  page: number = 1,
  pageSize: number = 100
): Promise<NotificationDTO[] | null> {
  const query = new URLSearchParams({ page: page.toString(), pageSize: pageSize.toString() });
  const url = `${API_BASE_URL}/api/notifications?${query.toString()}`;

  return await getRequest<NotificationDTO[]>(url);
}