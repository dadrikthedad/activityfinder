// shared/utils/api/fetchWithAuth.native.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetchWithAuthCore } from '../../../shared/utils/api/fetchWithAuthCore';
import type { FetchWithAuthFunction, LogLevel } from '../../../shared/utils/api/fetchWithAuth.types';

export const fetchWithAuth: FetchWithAuthFunction = async <T>(
  url: string,
  options: RequestInit = {},
  token?: string,
  logLevel: LogLevel = "verbose"  // ✅ Type eksplisitt som LogLevel
) => {
  const authToken = token || await AsyncStorage.getItem("token");
  
  if (!authToken) {
    throw new Error("No auth token found.");
  }
  
  return fetchWithAuthCore<T>(url, options, authToken, logLevel);
};