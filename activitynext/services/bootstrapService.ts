import { fetchWithAuth } from "@/utils/api/fetchWithAuth";
import { API_BASE_URL } from "@/constants/routes";
import { CriticalBootstrapResponseDTO } from "@/types/bootstrap/CriticalBootstrapResponseDTO";
import { SecondaryBootstrapResponseDTO } from "@/types/bootstrap/SecondaryBootstrapResponseDTO";


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


// Marker bruker som online (for senere implementasjon)
export async function markUserOnline(deviceId: string, platform: string = "web"): Promise<{ status: string } | null> {
  const url = `${API_BASE_URL}/api/me/online`;
  
  console.log("🟢 Markerer bruker som online:", url);
  
  return await fetchWithAuth<{ status: string }>(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ deviceId, platform }),
  });
}

// Marker bruker som offline (for senere implementasjon)
export async function markUserOffline(deviceId: string): Promise<{ status: string } | null> {
  const url = `${API_BASE_URL}/api/me/offline`;
  
  console.log("🔴 Markerer bruker som offline:", url);
  
  return await fetchWithAuth<{ status: string }>(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ deviceId }),
  });
}