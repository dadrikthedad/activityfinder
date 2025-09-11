// @/services/OnlineStatusService.ts (React Native) - Oppdatert til kun headers
import { API_BASE_URL } from "@/constants/routes";
import { postRequest } from "../baseService";
import { OnlineStatusRequest, OnlineStatusResponse, OfflineStatusRequest } from "@shared/types/OnlineStatusRequestDTO";
import { getPlatform, getCapabilities } from "@/utils/device/UserOnlineFunctions";

// Mark user as online - deviceId kommer fra X-Device-ID header
export async function markUserOnline(request: Omit<OnlineStatusRequest, 'deviceId'>): Promise<OnlineStatusResponse | null> {
  const url = `${API_BASE_URL}/api/me/online`;
  return await postRequest<OnlineStatusResponse, Omit<OnlineStatusRequest, 'deviceId'>>(url, request);
}

// Mark user as offline - deviceId kommer fra X-Device-ID header
export async function markUserOffline(): Promise<OnlineStatusResponse | null> {
  const url = `${API_BASE_URL}/api/me/offline`;
 
  console.log("🔴 Markerer bruker som offline:", url);
 
  // Ingen request body nødvendig - deviceId kommer fra header
  return await postRequest<OnlineStatusResponse>(url, {});
}

// Send heartbeat to keep connection alive - deviceId kommer fra X-Device-ID header
export async function sendHeartbeat(): Promise<{ status: string } | null> {
  const url = `${API_BASE_URL}/api/me/heartbeat`;
  
  // console.log("💓 Sender heartbeat:", url);
  
  // Device ID sendes automatisk via X-Device-ID header
  return await postRequest<{ status: string }>(url, {}, "none");
}

// Convenience function for marking online with defaults (React Native optimized)
export async function markOnlineWithDefaults(
  customCapabilities?: string[]
): Promise<OnlineStatusResponse | null> {
  // Device ID sendes automatisk via header - ikke nødvendig i request body
  const platform = getPlatform();
  const capabilities = customCapabilities || getCapabilities();
 
  return markUserOnline({
    // deviceId fjernet - kommer fra X-Device-ID header
    platform,
    lastBootstrapAt: Date.now(),
    capabilities,
  });
}

// Convenience function for marking offline with defaults (React Native optimized)
export async function markOfflineWithDefaults(): Promise<OnlineStatusResponse | null> {
  // Device ID sendes automatisk via header - ikke nødvendig i request body
  return markUserOffline();
}

// Heartbeat with error handling (React Native optimized)
export async function sendHeartbeatSafe(): Promise<boolean> {
  try {
    // Device ID parameter fjernet - kommer automatisk fra header
    const result = await sendHeartbeat();
    return result?.status === 'ok';
  } catch (error) {
    console.warn('⚠️ Heartbeat failed:', error);
    return false;
  }
}
