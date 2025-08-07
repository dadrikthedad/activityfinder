// shared/utils/api/fetchWithAuth.types.ts
export type LogLevel = "none" | "basic" | "verbose";

export interface FetchWithAuthFunction {
  <T>(
    url: string,
    options?: RequestInit,
    token?: string,
    logLevel?: LogLevel
  ): Promise<T | null>;
}