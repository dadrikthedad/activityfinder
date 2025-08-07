// Her henter vi de forskjellige endepunktene relatert til UserSettings
import { UserSettingsDTO } from "@shared/types/UserSettingsDTO";
import { API_ROUTES } from "@shared/constants/routes";
import { fetchWithAuth } from "@/utils/api/fetchWithAuth.native";
import { API_BASE_URL } from "@/constants/routes";


export async function updateUserSettings(
  settings: Partial<UserSettingsDTO>,
  token: string
) {
  const response = await fetchWithAuth<any>(`${API_BASE_URL}${API_ROUTES.userSettings}`, {
    method: "PATCH",
    body: JSON.stringify(settings),
  }, token);

  if (!response) {
    throw new Error("Failed to update settings");
  }
  
  return response;
}