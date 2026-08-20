import { SyncResponseDTO } from "@shared/types/sync/SyncResponseDTO";
import { fetchWithAuth } from "@/utils/api/fetchWithAuthNative";
import { API_BASE_URL } from "@/constants/routes";

// Backend tracker sync-state per enhet via DeviceSyncState — ingen token nødvendig
export async function getSyncUpdates(): Promise<SyncResponseDTO | null> {
  return await fetchWithAuth<SyncResponseDTO>(`${API_BASE_URL}/api/SyncEvent/sync`);
}
