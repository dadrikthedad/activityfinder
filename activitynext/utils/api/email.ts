import { API_BASE_URL } from "@/services/user"; // eller fra user.ts om du deler der

export async function checkEmailAvailability(email: string): Promise<boolean> {
  try {
    const normalized = email.trim().toLowerCase();
    const res = await fetch(`${API_BASE_URL}/api/user/check-email?email=${normalized}`);

    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || "Email check failed");
    }

    const data = await res.json();
    return !data.exists;
  } catch (error) {
    console.error("❌ Error checking email availability:", error);
    return false;
  }
}