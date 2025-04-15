import { fetchWithAuth } from "@/utils/api/fetchWithAuth";
import type { PublicProfileDTO } from "@/types/PublicProfileDTO";

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "https://activityfinder-gnaacbg9gsgjh7b7.swedencentral-01.azurewebsites.net";


  // 📝 Oppdater bio (PATCH)
  export async function updateBio(newBio: string, token: string): Promise<void> {
    const body = JSON.stringify(newBio); // Fortsatt string som forventet av backend
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

// Laster opp profilbilde
export async function uploadProfileImage(file: File, token: string): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${API_BASE_URL}/api/profile/upload-profile-image`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`, // Kan være nok, du trenger ikke bruke fetchWithAuth hvis du bruker formData
    },
    body: formData,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.message || "Failed to upload image");
  }

  const data = await res.json();
  return data.imageUrl; // returnerer URL-en til det opplastede bildet
}

// 🔍 Henter offentlig profil med ID (f.eks. til /profile/[id])
export async function getUserProfile(userId: number, token?: string, options?: RequestInit): Promise<PublicProfileDTO> {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE_URL}/api/profile/${userId}`, {
    headers,
    ...options,
    next: options?.cache ? undefined : { revalidate: 60 },
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.message || "Failed to fetch public profile");
  }

  const data: PublicProfileDTO = await res.json();
  return data;
}