import { fetchWithAuth } from "@/utils/api/fetchWithAuth.native";
import { API_BASE_URL } from "@/constants/routes";
import { CriticalBootstrapResponseDTO } from "@shared/types/bootstrap/CriticalBootstrapResponseDTO";
import { SecondaryBootstrapResponseDTO } from "@shared/types/bootstrap/SecondaryBootstrapResponseDTO";


// Henter kritisk data for rask oppstart av appen
export async function getCriticalBootstrap(): Promise<CriticalBootstrapResponseDTO | null> {
  const url = `${API_BASE_URL}/api/me/bootstrap/critical`;
  
  console.log("🚀 Henter kritisk bootstrap data:", url);
  
  return await fetchWithAuth<CriticalBootstrapResponseDTO>(url);
}

// Henter sekundær data i bakgrunnen etter kritisk data er lastet
export async function getSecondaryBootstrap(): Promise<SecondaryBootstrapResponseDTO | null> {
  const url = `${API_BASE_URL}/api/me/bootstrap/secondary`;
  
  console.log("📚 Henter sekundær bootstrap data:", url);
  
  return await fetchWithAuth<SecondaryBootstrapResponseDTO>(url);
}
