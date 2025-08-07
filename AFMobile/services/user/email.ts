// Sjekker om eposten er tilgjengelig eller allerede lagret i databasen. Går til CheckEmailAvailability() i backend
import { fetchWithAuth } from "@/utils/api/fetchWithAuth.native";
import { API_BASE_URL } from "@/constants/routes";

export async function checkEmailAvailability(email: string): Promise<boolean> {
  try {
    const normalized = email.trim().toLowerCase();
    const data = await fetchWithAuth<{ exists: boolean }>(`${API_BASE_URL}/api/user/check-email?email=${normalized}`);
    
    if (!data) {
      throw new Error("Email check failed");
    }
    
    return !data.exists;
  } catch (error) {
    console.error("❌ Error checking email availability:", error);
    return false;
  }
}