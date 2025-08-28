// baseService.ts - Oppdatert med device header support
import { fetchWithAuth } from "@/utils/api/fetchWithAuthNative";
import { deviceInfoService } from "@/utils/api/deviceInfo";
import { RateLimitError } from "@shared/types/security/RateLimitError";
import { BannedError } from "@shared/types/security/BannedError";

// Authenticated requests - bruker fetchWithAuth som allerede har device headers
export async function getRequest<T>(url: string): Promise<T | null> {
  return await fetchWithAuth<T>(url);
}

export async function postRequest<T, D = Record<string, unknown>>(url: string, data?: D): Promise<T | null> {
  return await fetchWithAuth<T>(url, {
    method: "POST",
    body: data ? JSON.stringify(data) : undefined,
  });
}

export async function putRequest<T, D = Record<string, unknown>>(url: string, data?: D): Promise<T | null> {
  return await fetchWithAuth<T>(url, {
    method: "PUT",
    body: data ? JSON.stringify(data) : undefined,
  });
}

export async function deleteRequest<T>(url: string): Promise<T | null> {
  return await fetchWithAuth<T>(url, {
    method: "DELETE",
  });
}

export async function postFormDataRequest<T>(url: string, formData: FormData): Promise<T | null> {
  return await fetchWithAuth<T>(url, {
    method: "POST",
    body: formData,
  });
}

// Public requests - med device headers for ban system support
export async function postRequestPublic<T, D = Record<string, unknown>>(url: string, data?: D): Promise<T | null> {
  try {
    // Få device headers for public requests (login, register, etc.)
    const deviceHeaders = await deviceInfoService.getDeviceHeaders();
    
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...deviceHeaders, // Legg til device headers
      },
      body: data ? JSON.stringify(data) : undefined,
    });

    // Håndter rate limiting
    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After');
      const retrySeconds = parseInt(retryAfter || '60', 10);
      
      console.warn(`🚫 Rate limited. Retry after ${retrySeconds}s`);
      throw new RateLimitError(
        `Rate limit exceeded. Please wait ${retrySeconds} seconds before trying again.`,
        retrySeconds
      );
    }

    // Håndter IP ban
    if (response.status === 403) {
      const banReason = response.headers.get('X-Ban-Reason');
      if (banReason) {
        console.error(`🚫 Banned: ${banReason}`);
        throw new BannedError(`Access denied: ${banReason}`);
      }
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    // Log device info for debugging rate limit issues
    if (error instanceof RateLimitError || error instanceof BannedError) {
      const deviceInfo = await deviceInfoService.getDeviceInfo();
      console.log('🔍 Device info for debugging:', {
        deviceId: deviceInfo.deviceId.substring(0, 8) + '...',
        platform: deviceInfo.platform,
        appVersion: deviceInfo.appVersion,
      });
    }
    
    console.error("❌ Public POST request failed:", error);
    throw error;
  }
}

// Ny funksjon for public GET requests med device headers (hvis du trenger det)
export async function getRequestPublic<T>(url: string): Promise<T | null> {
  try {
    const deviceHeaders = await deviceInfoService.getDeviceHeaders();
    
    const response = await fetch(url, {
      method: "GET",
      headers: {
        ...deviceHeaders,
      },
    });

    // Same error handling som postRequestPublic
    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After');
      const retrySeconds = parseInt(retryAfter || '60', 10);
      throw new RateLimitError(
        `Rate limit exceeded. Please wait ${retrySeconds} seconds before trying again.`,
        retrySeconds
      );
    }

    if (response.status === 403) {
      const banReason = response.headers.get('X-Ban-Reason');
      if (banReason) {
        throw new BannedError(`Access denied: ${banReason}`);
      }
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    if (error instanceof RateLimitError || error instanceof BannedError) {
      const deviceInfo = await deviceInfoService.getDeviceInfo();
      console.log('🔍 Device info for debugging:', {
        deviceId: deviceInfo.deviceId.substring(0, 8) + '...',
        platform: deviceInfo.platform,
        appVersion: deviceInfo.appVersion,
      });
    }
    
    console.error("❌ Public GET request failed:", error);
    throw error;
  }
}

// Export error types for UI handling
export { RateLimitError, BannedError };