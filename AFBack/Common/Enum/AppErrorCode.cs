namespace AFBack.Common.Enum;

/// <summary>
/// Domenespesifikke feilkoder som deles mellom backend og frontend.
/// Sendes som "code"-felt i ProblemDetails-responsen.
/// Frontend speilet disse i shared/types/AppErrorCode.ts.
/// </summary>
public enum AppErrorCode
{
    Unknown = 0,

    // ── Generelle (1xxx) ──────────────────────────────
    Validation      = 1000,  // DataAnnotations / skjemavalidering
    NotFound        = 1001,
    Conflict        = 1002,
    Unauthorized    = 1003,
    Forbidden       = 1004,
    InternalError   = 1005,
    TooManyRequests = 1006,
    Gone            = 1007,

    // ── Autentisering (2xxx) ──────────────────────────
    InvalidCredentials  = 2000,
    AccountLocked       = 2001,
    EmailNotConfirmed   = 2002,
    PhoneNotConfirmed   = 2003,
    TokenExpired        = 2004,
    InvalidToken        = 2005,

    // ── Registrering (3xxx) ───────────────────────────
    EmailAlreadyExists      = 3000,
    InvalidRegistrationData = 3001,

    // ── Verifisering (4xxx) ───────────────────────────
    InvalidCode    = 4000,
    ExpiredCode    = 4001,
    AlreadyVerified = 4002,
    

    // ── Passord-reset (5xxx) ──────────────────────────
    EmailNotFound = 5000,
}
