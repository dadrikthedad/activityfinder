// shared/utils/api/fetchWithAuthCore.ts
import { LogLevel } from './fetchWithAuth.types';

export async function fetchWithAuthCore<T>(
  url: string,
  options: RequestInit = {},
  authToken: string,
  logLevel: LogLevel = "verbose"
): Promise<T | null> {
  // All din eksisterende logikk her (uten localStorage delen)
  if (!authToken) {
    throw new Error("No auth token found.");
  }
  
  if (logLevel !== "none") {
    console.log("🟡 fetchWithAuth - URL:", url);
    console.log("🟢 Token (first 20 chars):", authToken?.slice(0, 20));
  }

  // 🆕 Bygg headers som Record<string, string> for å unngå TypeScript feil
  const headers: Record<string, string> = {
    Authorization: `Bearer ${authToken}`,
  };

  // Legg til eksisterende headers fra options
  if (options.headers) {
    const existingHeaders = new Headers(options.headers);
    existingHeaders.forEach((value, key) => {
      headers[key] = value;
    });
  }

  // 🆕 Kun legg til Content-Type hvis body IKKE er FormData
  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }
  // FormData setter sin egen Content-Type med boundary automatisk

  const res = await fetch(url, {
    ...options,
    headers,
  });

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
}