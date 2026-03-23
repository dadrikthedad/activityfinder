// core/api/baseService.ts
import { fetchWithAuth } from "@/utils/api/fetchWithAuthNative";
import { deviceInfoService } from "@/utils/api/deviceInfo";
import { RateLimitError } from "@shared/types/security/RateLimitError";
import { BannedError } from "@shared/types/security/BannedError";
import { LogLevel } from "@shared/utils/api/fetchWithAuth.types";
import { throwProblemDetails } from "@/core/errors/ProblemDetails";

// ========== HJELPEFUNKSJON ==========

/**
 * Parser responsen som JSON kun hvis body faktisk inneholder JSON.
 * Returnerer null for tomme responser (f.eks. 200 OK uten body).
 */
async function parseJsonIfPresent<T>(response: Response): Promise<T | null> {
  const contentType = response.headers.get("content-type") ?? "";
  const contentLength = response.headers.get("content-length");

  // Ingen body hvis content-length er 0, eller content-type mangler JSON
  if (contentLength === "0") return null;
  if (!contentType.includes("application/json")) return null;

  const text = await response.text();
  if (!text || text.trim() === "") return null;

  return JSON.parse(text) as T;
}

// ========== AUTENTISERTE REQUESTS ==========

/**
 * Sender en autentisert GET-forespørsel.
 */
export async function getRequest<T>(url: string): Promise<T | null> {
  return await fetchWithAuth<T>(url);
}

/**
 * Sender en autentisert POST-forespørsel.
 */
export async function postRequest<T, D = Record<string, unknown>>(
  url: string,
  data?: D,
  logLevel?: LogLevel
): Promise<T | null> {
  return await fetchWithAuth<T>(url, {
    method: "POST",
    body: data ? JSON.stringify(data) : undefined,
  }, undefined, logLevel);
}

/**
 * Sender en autentisert PUT-forespørsel.
 */
export async function putRequest<T, D = Record<string, unknown>>(url: string, data?: D): Promise<T | null> {
  return await fetchWithAuth<T>(url, {
    method: "PUT",
    body: data ? JSON.stringify(data) : undefined,
  });
}

/**
 * Sender en autentisert DELETE-forespørsel.
 */
export async function deleteRequest<T>(url: string): Promise<T | null> {
  return await fetchWithAuth<T>(url, { method: "DELETE" });
}

/**
 * Sender en autentisert POST-forespørsel med FormData (multipart).
 */
export async function postFormDataRequest<T>(url: string, formData: FormData): Promise<T | null> {
  return await fetchWithAuth<T>(url, { method: "POST", body: formData });
}

// ========== OFFENTLIGE REQUESTS ==========

/**
 * Sender en offentlig (ikke-autentisert) POST-forespørsel.
 * Kaster RateLimitError ved 429, BannedError ved 403 med X-Ban-Reason.
 * Alle andre feil parses som ProblemDetails.
 * Returnerer null for vellykkede responser uten body (f.eks. 200 OK fra void-endepunkter).
 */
export async function postRequestPublic<T, D = Record<string, unknown>>(url: string, data?: D): Promise<T | null> {
  try {
    const deviceHeaders = await deviceInfoService.getDeviceHeaders();

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...deviceHeaders },
      body: data ? JSON.stringify(data) : undefined,
    });

    if (response.status === 429) {
      const retrySeconds = parseInt(response.headers.get('Retry-After') || '60', 10);
      throw new RateLimitError(`Rate limit exceeded. Please wait ${retrySeconds} seconds.`, retrySeconds);
    }

    if (response.status === 403) {
      const banReason = response.headers.get('X-Ban-Reason');
      if (banReason) throw new BannedError(`Access denied: ${banReason}`);
    }

    if (!response.ok) {
      await throwProblemDetails(response);
    }

    return await parseJsonIfPresent<T>(response);
  } catch (error) {
    console.error("❌ Public POST request failed:", error);
    throw error;
  }
}

/**
 * Sender en offentlig (ikke-autentisert) GET-forespørsel.
 * Kaster RateLimitError ved 429, BannedError ved 403 med X-Ban-Reason.
 * Alle andre feil parses som ProblemDetails.
 */
export async function getRequestPublic<T>(url: string): Promise<T | null> {
  try {
    const deviceHeaders = await deviceInfoService.getDeviceHeaders();

    const response = await fetch(url, {
      method: "GET",
      headers: { ...deviceHeaders },
    });

    if (response.status === 429) {
      const retrySeconds = parseInt(response.headers.get('Retry-After') || '60', 10);
      throw new RateLimitError(`Rate limit exceeded. Please wait ${retrySeconds} seconds.`, retrySeconds);
    }

    if (response.status === 403) {
      const banReason = response.headers.get('X-Ban-Reason');
      if (banReason) throw new BannedError(`Access denied: ${banReason}`);
    }

    if (!response.ok) {
      await throwProblemDetails(response);
    }

    return await parseJsonIfPresent<T>(response);
  } catch (error) {
    console.error("❌ Public GET request failed:", error);
    throw error;
  }
}

export { RateLimitError, BannedError };
