// services/security.ts
import { fetchWithAuth } from "@/utils/api/fetchWithAuth";
import { API_BASE_URL } from "@/services/user"; // samme base-url


interface UpdatePasswordDTO {
  currentPassword: string;
  newPassword: string;
  confirmNewPassword: string;
}

export async function updateEmail(newEmail: string, currentPassword: string, token: string): Promise<void> {
    const body = { newEmail, currentPassword };
  
    const result = await fetchWithAuth<{ message: string }>(
      `${API_BASE_URL}/api/user/email`,
      {
        method: "PATCH",
        body: JSON.stringify(body),
      },
      token
    );
  
    if (!result) throw new Error("Failed to update email.");
  }

export async function updatePassword(
  currentPassword: string,
  newPassword: string,
  confirmNewPassword: string,
  token: string
): Promise<void> {
  const body: UpdatePasswordDTO = {
    currentPassword,
    newPassword,
    confirmNewPassword,
  };

  const result = await fetchWithAuth<{ message: string }>(
    `${API_BASE_URL}/api/user/password`,
    {
      method: "PATCH",
      body: JSON.stringify(body),
    },
    token
  );

  if (!result) throw new Error("Failed to update password.");
}
