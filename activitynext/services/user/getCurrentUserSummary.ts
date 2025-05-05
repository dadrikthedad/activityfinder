// API-kall til backend sin UserController.cs sin getUserSummary
import { fetchWithAuth } from "@/utils/api/fetchWithAuth";
import { API_BASE_URL } from "@/constants/routes";
import { UserSummaryDTO } from "@/types/UserSummaryDTO";

export async function getCurrentUserSummary(): Promise<UserSummaryDTO | null> {
  return await fetchWithAuth<UserSummaryDTO>(`${API_BASE_URL}/api/user/summary`);
}