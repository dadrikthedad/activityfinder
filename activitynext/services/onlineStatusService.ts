// @/services/onlineStatusService.ts
import { API_BASE_URL } from "@/constants/api/routes";
import { postRequest } from "./baseService";
import { OnlineStatusRequest, OnlineStatusResponse, OfflineStatusRequest } from "@shared/types/OnlineStatusRequestDTO";
import { generateDeviceId, getPlatform } from "@/functions/bootstrap/UserOnlineFunctions";

// Mark user as online
export async function markUserOnline(request: OnlineStatusRequest): Promise<OnlineStatusResponse | null> {
  const url = `${API_BASE_URL}/api/me/online`;
  
  console.log("🟢 Markerer bruker som online:", url, request);
  
  return await postRequest<OnlineStatusResponse, OnlineStatusRequest>(url, request);
}

// Mark user as offline
export async function markUserOffline(request: OfflineStatusRequest): Promise<OnlineStatusResponse | null> {
  const url = `${API_BASE_URL}/api/me/offline`;
  
  console.log("🔴 Markerer bruker som offline:", url, request);
  
  return await postRequest<OnlineStatusResponse, OfflineStatusRequest>(url, request);
}

// Send heartbeat to keep connection alive (special case - needs custom header)
export async function sendHeartbeat(deviceId: string): Promise<{ status: string } | null> {
  const url = `${API_BASE_URL}/api/me/heartbeat`;
  
  console.log("💓 Sender heartbeat:", url, { deviceId });
  
  // Note: Can't use postRequest for this since we need X-Device-Id header
  const { fetchWithAuth } = await import("@/utils/api/fetchWithAuth");
  
  return await fetchWithAuth<{ status: string }>(url, {
    method: "POST",
    headers: {
      "X-Device-Id": deviceId,
    },
  });
}

// Convenience function for marking online with defaults
export async function markOnlineWithDefaults(
  capabilities: string[] = ['signalr', 'push']
): Promise<OnlineStatusResponse | null> {
  const deviceId = generateDeviceId();
  const platform = getPlatform();
  
  return markUserOnline({
    deviceId,
    platform,
    lastBootstrapAt: Date.now(),
    capabilities,
  });
}

// Convenience function for marking offline with defaults
export async function markOfflineWithDefaults(): Promise<OnlineStatusResponse | null> {
  const deviceId = generateDeviceId();
  
  return markUserOffline({
    deviceId,
  });
}

// Heartbeat with error handling
export async function sendHeartbeatSafe(deviceId?: string): Promise<boolean> {
  try {
    const id = deviceId || generateDeviceId();
    const result = await sendHeartbeat(id);
    return result?.status === 'ok';
  } catch (error) {
    console.warn('⚠️ Heartbeat failed:', error);
    return false;
  }
}
