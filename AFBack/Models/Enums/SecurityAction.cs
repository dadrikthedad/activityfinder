namespace AFBack.Models.Enums;

public enum SecurityAction
{
    None = 0,
    
    // ======================== Logging ========================
    LoggedOnly = 1,              // Bare logget, ingen action
    
    // ======================== Warnings ========================
    WarningIssued = 10,          // Varsel sendt til bruker
    EmailAlertSent = 11,         // Email-varsel til bruker/admin
    
    // ======================== Authentication ========================
    TwoFactorRequired = 20,      // Krev 2FA
    CaptchaRequired = 21,        // Krev CAPTCHA
    EmailVerificationRequired = 22,
    
    // ======================== Rate Limiting ========================
    RateLimited = 30,            // Rate limit aktivert
    TemporarilySlowed = 31,      // Request delay pålagt
    
    // ======================== Blocking ========================
    RequestBlocked = 40,         // Enkelt request blokkert
    IPBlocked = 41,              // IP-adresse blokkert
    IPBlockedTemporarily = 42,   // IP blokkert midlertidig (X minutter)
    IPBlockedPermanently = 43,   // IP permanent blokkert
    
    // ======================== Account Actions ========================
    AccountLocked = 50,          // Konto låst
    AccountLockedTemporarily = 51,
    AccountSuspended = 52,       // Konto suspendert
    AccountFlagged = 53,         // Konto flagget for review
    
    // ======================== Session ========================
    SessionTerminated = 60,      // Sesjon avsluttet
    AllSessionsTerminated = 61,  // Alle sesjoner avsluttet
    RefreshTokenRevoked = 62,    // Refresh token tilbakekalt
    
    // ======================== Device ========================
    DeviceBlocked = 70,          // Device blokkert
    DeviceUntrusted = 71,        // Device merket som untrusted
    
    // ======================== Admin Review ========================
    EscalatedToAdmin = 80,       // Sendt til admin for review
    ManualReviewRequired = 81,   // Krever manuell review
    
    // ======================== Other ========================
    AccessDenied = 90,           // Tilgang nektet
    RedirectedToSafePage = 91,   // Redirected til sikker side
}
