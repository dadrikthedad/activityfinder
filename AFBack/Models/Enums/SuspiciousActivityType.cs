namespace AFBack.Models.Enums;

public enum SuspiciousActivityType
{
    Unknown = 0,
    
    // ======================== Login-relatert ========================
    FailedLogin = 1,
    TooManyFailedLogins = 2,
    BruteForceAttempt = 3,
    LoginFromNewLocation = 4,
    LoginFromNewDevice = 5,
    ImpossibleTravel = 6,          
    
    // ======================== Rate Limiting ========================
    TooManyRequests = 10,
    APIAbuse = 11,
    RateLimitExceeded = 12,
    
    // ======================== Account-relatert ========================
    SuspiciousRegistration = 20,
    MultipleAccountCreation = 21,
    EmailEnumeration = 22,          
    
    // ======================== Data-relatert ========================
    UnauthorizedAccess = 30,
    DataExfiltration = 31,
    SuspiciousQuery = 32,
    
    // ======================== Botaktivitet ========================
    BotDetected = 40,
    AutomatedBehavior = 41,
    SuspiciousUserAgent = 42,
    
    // ======================== Sikkerhet ========================
    SQLInjectionAttempt = 50,
    XSSAttempt = 51,
    CSRFAttempt = 52,
    MaliciousPayload = 53,
    
    // ======================== Andre ========================
    SuspiciousIPAddress = 60,
    VPNOrProxyDetected = 61,
    BlockedCountry = 62,
}
