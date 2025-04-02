import { fetchWithAuth } from "@/utils/api/fetchWithAuth";

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "https://activityfinder-gnaacbg9gsgjh7b7.swedencentral-01.azurewebsites.net";

async function safePatch(path: string, body: object, token: string) {
  try {
    return await fetchWithAuth(`${API_BASE_URL}${path}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }, token);
  } catch (error) {
    console.error(`❌ Failed to update ${path}:`, error);
    throw error;
  }
}

export const updateUser = {
  updateFirstName: (firstName: string, token: string) =>
    safePatch("/api/user/first-name", { firstName }, token),

  updateMiddleName: (middleName: string, token: string) =>
    safePatch("/api/user/middle-name", { middleName }, token),

  updateLastName: (lastName: string, token: string) =>
    safePatch("/api/user/last-name", { lastName }, token),

  updatePhone: (phone: string, token: string) =>
    safePatch("/api/user/phone", { phone }, token),

  updateLocation: (location: { country: string; region: string }, token: string) =>
    safePatch("/api/user/location", location, token),

  updatePostalCode: (postalCode: string, token: string) =>
    safePatch("/api/user/postalcode", { postalCode }, token),

  updateGender: (gender: string, token: string) =>
    safePatch("/api/user/gender", { gender }, token),
};
