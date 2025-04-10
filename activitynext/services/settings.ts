// Her henter vi de forskjellige endepunktene relatert til UserSettings
import { UserSettingsDTO } from "@/types/UserSettingsDTO";
import { API_BASE_URL, API_ROUTES } from "@/constants/routes";


// Her oppdaterer vi userSettings ved å gjøre et API-kall, brukes i hooken useUpdateUserSettings.ts
export async function updateUserSettings(
  settings: Partial<UserSettingsDTO>,
  token: string
  ) {
  const response = await fetch(`${API_BASE_URL}${API_ROUTES.userSettings}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(settings),
  });

  if (!response.ok) {
    throw new Error("Failed to update settings");
  }

  return response.json();
}
  