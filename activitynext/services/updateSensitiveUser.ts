import { fetchWithAuth } from "@/utils/api/fetchWithAuth";

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "https://activityfinder-gnaacbg9gsgjh7b7.swedencentral-01.azurewebsites.net";

// ✅ Oppdaterer e-post
export async function updateEmail(token: string, newEmail: string) {
  return await fetchWithAuth(
    `${API_BASE_URL}/api/user/email`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newEmail }),
    },
    token
  );
}

// ✅ Oppdaterer passord
export async function updatePassword(
  token: string,
  currentPassword: string,
  newPassword: string
) {
  return await fetchWithAuth(
    `${API_BASE_URL}/api/user/password`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword }),
    },
    token
  );
}
