// services/blockService.ts
import { fetchWithAuth } from "@/utils/api/fetchWithAuth";
import { API_BASE_URL } from "@/constants/api/routes";

// Blokkerer en bruker
export async function blockUser(
  userId: number,
): Promise<{ message: string }> {
  const url = `${API_BASE_URL}/api/blocked/block/${userId}`;
  const data = await fetchWithAuth<{ message: string }>(url, {
    method: 'POST'
  });
 
  if (!data) {
    throw new Error('Failed to block user');
  }
 
  return data;
}

// Avblokkerer en bruker
export async function unblockUser(
  userId: number,
): Promise<{ message: string }> {
  const url = `${API_BASE_URL}/api/blocked/unblock/${userId}`;
  const data = await fetchWithAuth<{ message: string }>(url, {
    method: 'DELETE'
  });
 
  if (!data) {
    throw new Error('Failed to unblock user');
  }
 
  return data;
}
