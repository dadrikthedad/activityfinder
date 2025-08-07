// shared/utils/api/fetchWithAuth.web.ts
import { fetchWithAuthCore } from '../../../shared/utils/api/fetchWithAuthCore';
import type { FetchWithAuthFunction, LogLevel } from '../../../shared/utils/api/fetchWithAuth.types';

export const fetchWithAuth: FetchWithAuthFunction = async <T>(
  url: string,
  options: RequestInit = {},
  token?: string,
  logLevel: LogLevel = "verbose"  // ✅ Type eksplisitt som LogLevel
) => {
  const authToken = token || localStorage.getItem("token");
  
  if (!authToken) {
    throw new Error("No auth token found.");
  }
  
  return fetchWithAuthCore<T>(url, options, authToken, logLevel);
};