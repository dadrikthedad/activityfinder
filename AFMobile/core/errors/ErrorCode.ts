// core/errors/ErrorCode.ts
// Domenespesifikke feilkoder for AFMobile.
// Tilsvarer ErrorTypeEnum i AFBack, men tilpasset frontend-behov.

export enum AuthErrorCode {
  InvalidCredentials = "AUTH_INVALID_CREDENTIALS",
  EmailNotVerified   = "AUTH_EMAIL_NOT_VERIFIED",
  PhoneNotVerified   = "AUTH_PHONE_NOT_VERIFIED",
  AccountLocked      = "AUTH_ACCOUNT_LOCKED",
  RateLimited        = "AUTH_RATE_LIMITED",
  NetworkError       = "AUTH_NETWORK_ERROR",
  ServerError        = "AUTH_SERVER_ERROR",
  Unknown            = "AUTH_UNKNOWN",
}

export enum RegistrationErrorCode {
  EmailTaken        = "REG_EMAIL_TAKEN",
  InvalidData       = "REG_INVALID_DATA",
  RateLimited       = "REG_RATE_LIMITED",
  NetworkError      = "REG_NETWORK_ERROR",
  ServerError       = "REG_SERVER_ERROR",
  Unknown           = "REG_UNKNOWN",
}

export enum VerificationErrorCode {
  InvalidCode       = "VER_INVALID_CODE",
  ExpiredCode       = "VER_EXPIRED_CODE",
  AlreadyVerified   = "VER_ALREADY_VERIFIED",
  RateLimited       = "VER_RATE_LIMITED",
  NetworkError      = "VER_NETWORK_ERROR",
  ServerError       = "VER_SERVER_ERROR",
  Unknown           = "VER_UNKNOWN",
}

export enum PasswordResetErrorCode {
  InvalidCode            = "PWD_INVALID_CODE",
  ExpiredCode            = "PWD_EXPIRED_CODE",
  EmailNotFound          = "PWD_EMAIL_NOT_FOUND",
  SessionNotVerified     = "PWD_SESSION_NOT_VERIFIED",
  SessionExpired         = "PWD_SESSION_EXPIRED",
  RateLimited            = "PWD_RATE_LIMITED",
  NetworkError           = "PWD_NETWORK_ERROR",
  ServerError            = "PWD_SERVER_ERROR",
  Unknown                = "PWD_UNKNOWN",
}

// Fellestype for alle feilkoder — nyttig for generiske funksjoner
export type AppErrorCode =
  | AuthErrorCode
  | RegistrationErrorCode
  | VerificationErrorCode
  | PasswordResetErrorCode;
