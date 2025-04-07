import { API_BASE_URL } from "@/services/user";
import type { PublicProfileDTO } from "@/types/PublicProfile";

export async function getUserProfile(userId: number): Promise<PublicProfileDTO> {
  const res = await fetch(`${API_BASE_URL}/api/profile/${userId}`, {
    next: { revalidate: 60 },
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.message || "Failed to fetch user profile");
  }

  return res.json();
}
  