import { fetchWithAuth } from "@/utils/api/fetchWithAuth";

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "https://activityfinder-gnaacbg9gsgjh7b7.swedencentral-01.azurewebsites.net";

// Hent profilinfo
export async function getProfile() {
    const res = await fetch(`${API_BASE_URL}/api/Profile`, {
      method: "GET",
      credentials: "include",
    });
  
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.message || "Failed to fetch profile");
    }
  
    return res.json();
  }

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

export async function updateProfileImage(formData: FormData, token: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/profile/image`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.message || "Failed to upload image");
  }
}
