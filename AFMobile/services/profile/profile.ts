// AFMobile/services/profileService.ts
import { fetchWithAuth } from "@/utils/api/fetchWithAuthNative";
import { API_BASE_URL } from "@/constants/routes";
import type { PublicProfileDTO } from "@shared/types/PublicProfileDTO";

// React Native file type
interface RNFile {
  uri: string;
  type: string;
  name: string;
}

// 📝 Oppdater bio (PATCH)
export async function updateBio(newBio: string, token: string): Promise<void> {
  const body = JSON.stringify(newBio);
  await fetchWithAuth(`${API_BASE_URL}/api/profile/bio`, {
    method: "PATCH",
    body,
  }, token);
}

// 🌐 Oppdater websites (PATCH)
interface UpdateWebsitesDTO {
  websites: string[];
}

export async function updateWebsites(websites: string[], token: string): Promise<void> {
  const body: UpdateWebsitesDTO = { websites };
  await fetchWithAuth(`${API_BASE_URL}/api/profile/websites`, {
    method: "PATCH",
    body: JSON.stringify(body),
  }, token);
}

// Laster opp profilbilde (tilpasset for RN)
export async function uploadProfileImage(file: RNFile, token: string): Promise<string> {
  const formData = new FormData();
  formData.append("file", {
    uri: file.uri,
    type: file.type,
    name: file.name,
  } as any);

  const response = await fetchWithAuth<{ imageUrl: string }>(`${API_BASE_URL}/api/profile/upload-profile-image`, {
    method: "POST",
    body: formData,
  }, token);

  if (!response) {
    throw new Error("Failed to upload image");
  }

  return response.imageUrl;
}

// 🔍 Henter offentlig profil
export async function getUserProfile(userId: number, token?: string): Promise<PublicProfileDTO> {
  const response = await fetchWithAuth<PublicProfileDTO>(`${API_BASE_URL}/api/profile/${userId}`, {}, token);
  
  if (!response) {
    throw new Error("Failed to fetch public profile");
  }

  return response;
}