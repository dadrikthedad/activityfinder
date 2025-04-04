import { API_BASE_URL } from "@/services/user";

export async function getUserProfile(userId: number) {
    const res = await fetch(`${API_BASE_URL}/api/profile/${userId}`, {
      next: { revalidate: 60 }, // eller cache: 'no-store'
    });
  
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.message || "Failed to fetch user profile");
    }
  
    return res.json();
  }
  