// core/errors/AppError.ts
// Typed feilklasse for uventede/tekniske feil som fortsatt kastes som exceptions.
// Brukes der Result ikke passer — f.eks. i initialisering eller infrastrukturkode.
// Ordinære forretningsfeil skal bruke Result i stedet.

import type { AppErrorCode } from "./ErrorCode";

export class AppError extends Error {
  constructor(
    public readonly code: AppErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
    this.name = "AppError";
  }
}

// Hjelpefunksjon for å mappe HTTP-statuskode til riktig feilkode
// Brukes i baseService når vi mottar feil fra backend
export function httpStatusToAuthErrorCode(status: number): AppErrorCode {
  // Importeres dynamisk for å unngå sirkulære avhengigheter
  const { AuthErrorCode } = require("./ErrorCode");

  switch (status) {
    case 401: return AuthErrorCode.InvalidCredentials;
    case 403: return AuthErrorCode.AccountLocked;
    case 429: return AuthErrorCode.RateLimited;
    case 500:
    case 502:
    case 503: return AuthErrorCode.ServerError;
    default:  return AuthErrorCode.Unknown;
  }
}
