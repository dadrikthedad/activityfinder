// services/settings.ts
import { UserSettingsDTO } from "@/types/settings";

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "https://activityfinder-gnaacbg9gsgjh7b7.swedencentral-01.azurewebsites.net";

export async function getUserSettings(token: string) {
    const res = await fetch(`${API_BASE_URL}/api/usersettings`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  
    if (!res.ok) throw new Error("Could not load settings");
    return res.json();
  }
  
  export async function updateUserSettings(settings: UserSettingsDTO, token: string) {
    const res = await fetch(`${API_BASE_URL}/api/usersettings`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(settings),
    });
  
    if (!res.ok) throw new Error("Could not save settings");
    return res.json();
  }
  