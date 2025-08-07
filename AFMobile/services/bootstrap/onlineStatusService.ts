// @/services/OnlineStatusService.ts (React Native)
import { API_BASE_URL } from "@/constants/routes";
import { postRequest } from "../baseService";
import { OnlineStatusRequest, OnlineStatusResponse, OfflineStatusRequest } from "@shared/types/OnlineStatusRequestDTO";
import { generateDeviceId, getPlatform, getCapabilities } from "@/utils/device/UserOnlineFunctions";
import { fetchWithAuth } from "@/utils/api/fetchWithAuth.native";


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
 
  return await fetchWithAuth<{ status: string }>(url, {
    method: "POST",
    headers: {
      "X-Device-Id": deviceId,
    },
  });
}

// Convenience function for marking online with defaults (React Native optimized)
export async function markOnlineWithDefaults(
  customCapabilities?: string[]
): Promise<OnlineStatusResponse | null> {
  const deviceId = await generateDeviceId(); // Note: async in RN
  const platform = getPlatform();
  const capabilities = customCapabilities || getCapabilities();
 
  return markUserOnline({
    deviceId,
    platform,
    lastBootstrapAt: Date.now(),
    capabilities,
  });
}

// Convenience function for marking offline with defaults (React Native optimized)
export async function markOfflineWithDefaults(): Promise<OnlineStatusResponse | null> {
  const deviceId = await generateDeviceId(); // Note: async in RN
 
  return markUserOffline({
    deviceId,
  });
}

// Heartbeat with error handling (React Native optimized)
export async function sendHeartbeatSafe(deviceId?: string): Promise<boolean> {
  try {
    const id = deviceId || await generateDeviceId(); // Note: async in RN
    const result = await sendHeartbeat(id);
    return result?.status === 'ok';
  } catch (error) {
    console.warn('⚠️ Heartbeat failed:', error);
    return false;
  }
}

// New: Start online status management with app lifecycle handling
export async function startOnlineStatusManager(): Promise<() => void> {
  try {
    // Mark as online when starting
    await markOnlineWithDefaults();
    
    // Setup app state handlers for automatic offline marking
    const { setupAppStateHandlers } = await import("@/utils/device/UserOnlineFunctions");
    const cleanup = setupAppStateHandlers(API_BASE_URL);
    
    console.log("✅ Online status manager started");
    
    return cleanup;
  } catch (error) {
    console.error("❌ Failed to start online status manager:", error);
    return () => {}; // Return empty cleanup function
  }
}

// New: Send periodic heartbeats
export function startHeartbeatInterval(intervalMs: number = 30000): () => void {
  let heartbeatInterval: NodeJS.Timeout;
  
  const startHeartbeat = async () => {
    const deviceId = await generateDeviceId();
    
    heartbeatInterval = setInterval(async () => {
      const success = await sendHeartbeatSafe(deviceId);
      if (!success) {
        console.warn("💔 Heartbeat failed, user may appear offline");
      }
    }, intervalMs);
  };
  
  startHeartbeat();
  
  return () => {
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
      console.log("🛑 Heartbeat interval stopped");
    }
  };
}

// New: Complete online status setup for React Native app
export async function initializeOnlineStatus(): Promise<{
  cleanup: () => void;
  stopHeartbeat: () => void;
}> {
  const cleanup = await startOnlineStatusManager();
  const stopHeartbeat = startHeartbeatInterval();
  
  return {
    cleanup,
    stopHeartbeat,
  };
}