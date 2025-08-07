// Sync-funksjon for å hente endringer siden siste sync (for senere implementasjon)
import { SyncResponseDTO } from "@shared/types/sync/SyncResponseDTO";
import { fetchWithAuth } from "@/utils/api/fetchWithAuth.native";
import { API_BASE_URL } from "@/constants/routes";

export async function getSyncUpdates(syncToken?: string): Promise<SyncResponseDTO | null> {
  const url = new URL(`${API_BASE_URL}/api/me/sync`);
  if (syncToken) {
    url.searchParams.set('since', syncToken);
  }
  
  return await fetchWithAuth<SyncResponseDTO>(url.toString());
}

export async function getFullSync(): Promise<SyncResponseDTO | null> {
  return await getSyncUpdates();
}
