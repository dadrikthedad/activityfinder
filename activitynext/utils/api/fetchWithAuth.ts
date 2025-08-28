// utils/api/fetchWithAuth.ts
import authService from '@/services/auth/authService';
import type { LogLevel } from '@shared/utils/api/fetchWithAuth.types';

export async function fetchWithAuth<T>(
  url: string,
  options: RequestInit = {},
  _token?: string, // Ignoreres - beholdt for bakoverkompatibilitet
  logLevel: LogLevel = "verbose"
): Promise<T | null> {
  if (logLevel !== "none") {
    console.log("🟡 fetchWithAuth - URL:", url);
  }

  try {
    const response = await authService.fetchWithAuth(url, options);
    return await handleResponse<T>(response, url, logLevel);
  } catch (error) {
    if (logLevel !== "none") {
      console.error("🔴 fetchWithAuth error:", error);
    }
    throw error;
  }
}

async function handleResponse<T>(
  response: Response,
  url: string,
  logLevel: LogLevel
): Promise<T | null> {
  const text = await response.text();

  if (!response.ok) {
    if (logLevel !== "none") {
      console.error(`🔴 API error (${response.status}) from ${url}:`, text);
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
    console.log("📦 Status code:", response.status);
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
}