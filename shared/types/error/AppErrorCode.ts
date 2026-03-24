// shared/types/error/AppErrorCode.ts
//
// Domenespesifikke feilkoder som deles mellom AFBack og AFMobile.
// Speil av AppErrorCode-enumen i AFBack (Common/Enum/AppErrorCode.cs).
//
// Backend sender koden som "code"-felt i AppProblemDetails-responsen:
// { "status": 401, "title": "...", "detail": "...", "code": 2002 }
//
// Frontend leser koden via ApiError.appCode og switcher på den
// i stedet for å string-matche feilmeldinger.

export enum AppErrorCode {
  Unknown = 0,

  // ── Generelle (1xxx) ──────────────────────────────
  Validation      = 1000,
  NotFound        = 1001,
  Conflict        = 1002,
  Unauthorized    = 1003,
  Forbidden       = 1004,
  InternalError   = 1005,
  TooManyRequests = 1006,
  Gone            = 1007,
  BadRequest      = 1008,
  EmailSendFailed = 1009,

  // ── Autentisering (2xxx) ──────────────────────────
  InvalidCredentials = 2000,
  AccountLocked      = 2001,
  EmailNotConfirmed  = 2002,
  PhoneNotConfirmed  = 2003,
  TokenExpired       = 2004,
  InvalidToken       = 2005,

  // ── Registrering (3xxx) ───────────────────────────
  EmailAlreadyExists      = 3000,
  InvalidRegistrationData = 3001,

  // ── Verifisering (4xxx) ───────────────────────────
  InvalidCode     = 4000,
  ExpiredCode     = 4001,
  AlreadyVerified = 4002,

  // ── Passord-reset (5xxx) ──────────────────────────
  EmailNotFound              = 5000,
  ResetSessionNotVerified    = 5001,  // SMS-koden er ikke verifisert (steg 3b ikke fullført)
  ResetSessionExpired        = 5002,  // 10-minuttersvinduet etter SMS-verifisering er utløpt

  // ── Kryptografi (7xxx) ────────────────────────────
  InvalidPublicKey = 7000,

  // ── Frontend-only (9xxx) ──────────────────────────
  // Disse sendes aldri fra backend — brukes kun i mapXxxError for nettverksfeil
  NetworkError = 9000,
}
