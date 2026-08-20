// API-kall til backend for hver enkelt patch til de forskjellige feltene i User.cs. Brukes i profilesettings, endrer navn, phone, location, gender fra User.cs, og kontaktEpost og kontaktTelefon fra profile.cs
import { fetchWithAuth } from "@/utils/api/fetchWithAuthNative";
import { API_BASE_URL } from "@/constants/routes";
import { ApiRoutes } from "@/core/api/routes";

async function safePatch(path: string, body: object, token: string): Promise<void> {
  try {
    await fetchWithAuth(`${API_BASE_URL}${path}`, { method: "PATCH", body: JSON.stringify(body) }, token);
  } catch (error) {
    console.error(`❌ Failed to update ${path}:`, error);
    throw error;
  }
}

async function safePut(url: string, body: object, token: string): Promise<void> {
  try {
    await fetchWithAuth(url, { method: "PUT", body: JSON.stringify(body) }, token);
  } catch (error) {
    console.error(`❌ Failed to update ${url}:`, error);
    throw error;
  }
}

export type UpdateFieldArgs = {
  updateName: { firstName: string; lastName: string };
  updatePhone: string;
  updateContactPhone: string;
  updateContactEmail: string;
};

type UpdateUserFunctions = {
  [K in keyof UpdateFieldArgs]: (value: UpdateFieldArgs[K], token: string) => Promise<void>;
};

export const updateUser: UpdateUserFunctions = {
  updateName: (value, token) =>
    safePut(ApiRoutes.account.updateName, { firstName: value.firstName, lastName: value.lastName }, token),
  updatePhone: (value, token) =>
    safePatch("/api/user/phone", { phone: value }, token),
  updateContactPhone: (value, token) =>
    safePatch("/api/profile/contact-phone", { contactPhone: value }, token),
  updateContactEmail: (value, token) =>
    safePatch("/api/profile/contact-email", { contactEmail: value }, token),
};
  