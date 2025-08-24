// utils/api/fetchWithAuthCore.ts
import { LogLevel } from '@shared/utils/api/fetchWithAuth.types';
import { deviceInfoService } from './deviceInfo';

export async function fetchWithAuthCoreNative<T>(
  url: string,
  options: RequestInit = {},
  authToken: string,
  logLevel: LogLevel = "verbose"
): Promise<T | null> {
  if (!authToken) {
    throw new Error("No auth token found.");
  }

  if (logLevel !== "none") {
    console.log("🟡 fetchWithAuth - URL:", url);
    console.log("🟢 Token (first 20 chars):", authToken?.slice(0, 20));
  }

  // Få device headers
  const deviceHeaders = await deviceInfoService.getDeviceHeaders();

  // Bygg headers som Record<string, string>
  const headers: Record<string, string> = {
    Authorization: `Bearer ${authToken}`,
    ...deviceHeaders, // Legg til device headers
  };

  // Legg til eksisterende headers fra options
  if (options.headers) {
    const existingHeaders = new Headers(options.headers);
    existingHeaders.forEach((value, key) => {
      headers[key] = value;
    });
  }

  // Kun legg til Content-Type hvis body IKKE er FormData
  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  try {
    const res = await fetch(url, {
      ...options,
      headers,
    });

    // Håndter rate limiting
    if (res.status === 429) {
      const retryAfter = res.headers.get('Retry-After');
      const retrySeconds = parseInt(retryAfter || '60', 10);
      
      if (logLevel !== "none") {
        console.warn(`🚫 Rate limited. Retry after ${retrySeconds}s`);
      }
      
      throw new RateLimitError(
        `Rate limit exceeded. Please wait ${retrySeconds} seconds before trying again.`, 
        retrySeconds
      );
    }

    // Håndter IP ban
    if (res.status === 403) {
      const banReason = res.headers.get('X-Ban-Reason');
      if (banReason) {
        if (logLevel !== "none") {
          console.error(`🚫 Banned: ${banReason}`);
        }
        throw new BannedError(`Access denied: ${banReason}`);
      }
    }

    const text = await res.text();

    if (!res.ok) {
      if (logLevel !== "none") {
        console.error(`🔴 API error (${res.status}) from ${url}:`, text);
      }
      try {
        const json = JSON.parse(text);
        if (typeof json === "object" && json !== null && "message" in json) {
          throw new Error(json.message);
        }
        throw new Error("Something went wrong.");
      } catch {
        throw new Error(text || "Something went wrong.");
      }
    }

    if (!text || text.trim() === "") {
      if (logLevel === "verbose") console.warn("⚠️ Empty response body");
      return null;
    }

    if (logLevel === "verbose") {
      console.log("📦 Status code:", res.status);
      console.log("📄 Raw text:", text);
    }

    try {
      const json = JSON.parse(text) as T;
      if (logLevel !== "none") {
        console.log("✅ Parsed JSON:", json);
      }
      return json;
    } catch (err) {
      if (logLevel !== "none") {
        console.error("❌ Invalid JSON response:", text, err);
      }
      return null;
    }

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
    
    throw error;
  }
}

// Custom error classes
export class RateLimitError extends Error {
  public retryAfter: number;

  constructor(message: string, retryAfter: number = 60) {
    super(message);
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;
  }
}

export class BannedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BannedError';
  }
}