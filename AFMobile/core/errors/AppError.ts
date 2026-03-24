// core/errors/AppError.ts
// Typed feilklasse for uventede/tekniske feil som fortsatt kastes som exceptions.
// Brukes der Result ikke passer — f.eks. i initialisering eller infrastrukturkode.
// Ordinære forretningsfeil skal bruke Result i stedet.

import type { AppErrorCode } from "@/core/errors/ErrorCode";

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
