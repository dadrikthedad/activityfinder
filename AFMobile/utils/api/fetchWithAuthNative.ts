// utils/api/fetchWithAuthNative.ts
import authServiceNative from '@/core/auth/authServiceNative';
import type { FetchWithAuthFunction, LogLevel } from '../../../shared/utils/api/fetchWithAuth.types';

export const fetchWithAuth: FetchWithAuthFunction = async <T>(
  url: string,
  options: RequestInit = {},
  _token?: string,
  logLevel: LogLevel = "verbose"
) => {
  if (logLevel !== "none") {
    console.log("🟡 fetchWithAuth - URL:", url);
  }

  try {
    const response = await authServiceNative.fetchWithAuth(url, options);
    return await handleResponse<T>(response, url, logLevel);
  } catch (error) {
    if (logLevel !== "none") {
      console.error("🔴 fetchWithAuth error:", error);
    }
    throw error;
  }
};

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

    let errorMessage: string;
    try {
      const json = JSON.parse(text);
      errorMessage = (typeof json === "object" && json !== null && "message" in json)
        ? json.message
        : "Something went wrong.";
    } catch {
      errorMessage = text || "Something went wrong.";
    }
    throw new Error(errorMessage);
  }

  if (!text || text.trim() === "") {
    if (logLevel === "verbose") console.warn("⚠️ Empty response body");
    return null;
  }

  if (logLevel === "verbose") {
    console.log("📦 Status code:", response.status);
  }

  try {
    return JSON.parse(text) as T;
  } catch (err) {
    if (logLevel !== "none") {
      console.error("❌ Invalid JSON response:", text, err);
    }
    return null;
  }
}
