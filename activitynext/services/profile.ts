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
