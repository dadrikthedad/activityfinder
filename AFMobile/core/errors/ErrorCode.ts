// core/errors/ErrorCode.ts
// Domenespesifikke feilkoder for AFMobile.
// Tilsvarer ErrorTypeEnum i AFBack, men tilpasset frontend-behov.

export enum AuthErrorCode {
  InvalidCredentials = "AUTH_INVALID_CREDENTIALS",
  EmailNotVerified   = "AUTH_EMAIL_NOT_VERIFIED",
  PhoneNotVerified   = "AUTH_PHONE_NOT_VERIFIED",
  AccountLocked      = "AUTH_ACCOUNT_LOCKED",
  RateLimited        = "AUTH_RATE_LIMITED",
  MfaRequired        = "AUTH_MFA_REQUIRED",
  NetworkError       = "AUTH_NETWORK_ERROR",
  ServerError        = "AUTH_SERVER_ERROR",
  Unknown            = "AUTH_UNKNOWN",
}

export enum RegistrationErrorCode {
  EmailTaken        = "REG_EMAIL_TAKEN",
  PhoneTaken        = "REG_PHONE_TAKEN",
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

export enum E2EESetupErrorCode {
  KeyGenerationFailed  = "E2EE_KEY_GENERATION_FAILED",
  StorageFailed        = "E2EE_STORAGE_FAILED",
  InvalidBackupPhrase  = "E2EE_INVALID_BACKUP_PHRASE",
  NetworkError         = "E2EE_NETWORK_ERROR",
  Unknown              = "E2EE_UNKNOWN",
}

export enum SearchErrorCode {
  NetworkError = "SEARCH_NETWORK_ERROR",
  ServerError  = "SEARCH_SERVER_ERROR",
  Unknown      = "SEARCH_UNKNOWN",
}

export enum ProfileErrorCode {
  NotFound     = "PROFILE_NOT_FOUND",
  ValidationError = "PROFILE_VALIDATION_ERROR",
  NetworkError = "PROFILE_NETWORK_ERROR",
  ServerError  = "PROFILE_SERVER_ERROR",
  Unknown      = "PROFILE_UNKNOWN",
}

export enum AccountErrorCode {
  Conflict              = "ACCOUNT_CONFLICT",
  InvalidCurrentPassword = "ACCOUNT_INVALID_CURRENT_PASSWORD",
  InvalidCode           = "ACCOUNT_INVALID_CODE",
  ExpiredCode           = "ACCOUNT_EXPIRED_CODE",
  RateLimited           = "ACCOUNT_RATE_LIMITED",
  NetworkError          = "ACCOUNT_NETWORK_ERROR",
  ServerError           = "ACCOUNT_SERVER_ERROR",
  Unknown               = "ACCOUNT_UNKNOWN",
}

export enum BlockingErrorCode {
  AlreadyBlocked = "BLOCKING_ALREADY_BLOCKED",
  NotBlocked     = "BLOCKING_NOT_BLOCKED",
  UserNotFound   = "BLOCKING_USER_NOT_FOUND",
  RateLimited    = "BLOCKING_RATE_LIMITED",
  ServerError    = "BLOCKING_SERVER_ERROR",
  Unknown        = "BLOCKING_UNKNOWN",
}

export enum ReportingErrorCode {
  AlreadyReported      = "REPORTING_ALREADY_REPORTED",
  SelfReport           = "REPORTING_SELF_REPORT",
  RateLimited          = "REPORTING_RATE_LIMITED",
  TooManyAttachments   = "REPORTING_TOO_MANY_ATTACHMENTS",
  AttachmentTooLarge   = "REPORTING_ATTACHMENT_TOO_LARGE",
  ServerError          = "REPORTING_SERVER_ERROR",
  Unknown              = "REPORTING_UNKNOWN",
}

// Kun brukt i Development — dev-innlogging som vilkårlig bruker
export enum DevErrorCode {
  NotFound     = "DEV_NOT_FOUND",
  NetworkError = "DEV_NETWORK_ERROR",
  ServerError  = "DEV_SERVER_ERROR",
  Unknown      = "DEV_UNKNOWN",
}

export enum MessagingErrorCode {
  RecipientNotFound  = "MSG_RECIPIENT_NOT_FOUND",
  Blocked            = "MSG_BLOCKED",
  AlreadyInGroup     = "MSG_ALREADY_IN_GROUP",
  InvalidGroup       = "MSG_INVALID_GROUP",
  ValidationError    = "MSG_VALIDATION_ERROR",
  EncryptionFailed   = "MSG_ENCRYPTION_FAILED",
  RateLimited        = "MSG_RATE_LIMITED",
  NetworkError       = "MSG_NETWORK_ERROR",
  ServerError        = "MSG_SERVER_ERROR",
  Unknown            = "MSG_UNKNOWN",
}

// Fellestype for alle feilkoder — nyttig for generiske funksjoner
export type AppErrorCode =
  | AuthErrorCode
  | RegistrationErrorCode
  | VerificationErrorCode
  | PasswordResetErrorCode
  | E2EESetupErrorCode
  | SearchErrorCode
  | ProfileErrorCode
  | AccountErrorCode
  | BlockingErrorCode
  | ReportingErrorCode
  | MessagingErrorCode
  | DevErrorCode;
