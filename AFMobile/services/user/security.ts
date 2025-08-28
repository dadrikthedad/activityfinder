// API-kall til backend med updateEmail() som oppdatere brukerens epost og updatePassword som oppdaterer passord
import { fetchWithAuth } from "@/utils/api/fetchWithAuthNative";
import { API_BASE_URL } from "@/constants/routes";


interface UpdatePasswordDTO {
  currentPassword: string;
  newPassword: string;
  confirmNewPassword: string;
}
// updateEmail() går til updateEmail() patch i bakckend
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
// updatePassword() går til updatePassword() patch i backend
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
