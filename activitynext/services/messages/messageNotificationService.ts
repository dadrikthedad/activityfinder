import { fetchWithAuth } from "@/utils/api/fetchWithAuth";// eller hvor du har den
import { PaginatedNotifications } from "@shared/types/PaginatedNotificationsDTO";
import { API_BASE_URL } from "@/constants/api/routes";


// Hente ALLE notifikasjoner
export async function getMessageNotifications(page = 1, pageSize = 20): Promise<PaginatedNotifications> {
  const url = `${API_BASE_URL}/api/MessageNotifications?page=${page}&pageSize=${pageSize}`;
  console.log("🔵 Henter varsler:", url);

  const result = await fetchWithAuth<PaginatedNotifications>(url);
  return result ?? {
    page,
    pageSize,
    totalCount: 0,
    totalPages: 0,
    notifications: []
  };
}

// Setter en melding som lest
export async function markMessageNotificationAsRead(id: number): Promise<void> {
    const url = `${API_BASE_URL}/api/MessageNotifications/mark-as-read/${id}`;
    await fetchWithAuth<void>(url, { method: "POST" }); // 👈 ikke returner
}

// Setter alle notifikasjoner som lest
export async function markAllMessageNotificationsAsRead(): Promise<void> {
  const url = `${API_BASE_URL}/api/MessageNotifications/mark-all-as-read`;
  await fetchWithAuth<void>(url, { method: "POST" });
}

// 🔔 Henter ID-er til samtaler med uleste notifications
export async function getUnreadConversationIds(): Promise<number[]> {
  const url = `${API_BASE_URL}/api/MessageNotifications/unread-conversations`;
  const ids = await fetchWithAuth<number[]>(url);
  return ids ?? [];
}
// Setter alle notifikasjoner til en samtale lest ved å være i bunn av en samtale
export async function markConversationNotificationsAsRead(conversationId: number): Promise<void> {
  const url = `${API_BASE_URL}/api/MessageNotifications/mark-conversation-as-read/${conversationId}`;
  await fetchWithAuth<void>(url, { method: "POST" });
}
