import { fetchWithAuth } from "@/utils/api/fetchWithAuth";

// Her oppdatere vi user med API-kall til backend

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "https://activityfinder-gnaacbg9gsgjh7b7.swedencentral-01.azurewebsites.net";

  async function safePatch(path: string, body: object, token: string): Promise<void> {
    try {
      await fetchWithAuth(`${API_BASE_URL}${path}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }, token);
    } catch (error) {
      console.error(`❌ Failed to update ${path}:`, error);
      throw error;
    }
  }

  export type UpdateFieldArgs = {
    // Disse ligger i user.cs
    updateFirstName: string;
    updateMiddleName: string;
    updateLastName: string;
    updatePhone: string;
    updatePostalCode: string;
    updateGender: string;
    updateLocation: { country: string; region: string };
    // Disse ligger i profile.cs
    updateContactPhone: string;
    updateContactEmail: string;
  };
  
  type UpdateUserFunctions = {
    [K in keyof UpdateFieldArgs]: (value: UpdateFieldArgs[K], token: string) => Promise<void>;
  };
  
  // Endepunkter til user.cs patchene
  export const updateUser: UpdateUserFunctions = {
    updateFirstName: (value, token) =>
      safePatch("/api/user/first-name", { firstName: value }, token),
    updateMiddleName: (value, token) =>
      safePatch("/api/user/middle-name", { middleName: value }, token),
    updateLastName: (value, token) =>
      safePatch("/api/user/last-name", { lastName: value }, token),
    updatePhone: (value, token) =>
      safePatch("/api/user/phone", { phone: value }, token),
    updatePostalCode: (value, token) =>
      safePatch("/api/user/postalcode", { postalCode: value }, token),
    updateGender: (value, token) =>
      safePatch("/api/user/gender", { gender: value }, token),
    updateLocation: (value, token) =>
      safePatch("/api/user/location", value, token),
    // Endepunkt til profile.cs patchene
    updateContactPhone: (value, token) =>
      safePatch("/api/profile/contact-phone", { contactPhone: value }, token),
    updateContactEmail: (value, token) =>
      safePatch("/api/profile/contact-email", { contactEmail: value }, token),
  };
  