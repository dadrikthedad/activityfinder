namespace AFBack.Infrastructure.Security.Enums;

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
    
    /// <summary>
    /// Hvis brukeren når RateLimit
    /// </summary>
    RateLimitExceeded = 12,
    
    /// <summary>
    /// Hvis brukeren når RateLimit på eposter
    /// </summary>
    EmailRateLimitExceeded = 13,
    
    /// <summary>
    /// Hvis brukeren når RateLimit på SMS
    /// </summary>
    SmsRateLimitExceeded = 14,
    
    
    // ======================== Account-relatert ========================
    SuspiciousRegistration = 20,
    MultipleAccountCreation = 21,
    
    /// <summary>
    /// Hvis brukeren prøver å sjekke om eposter eksisterer
    /// </summary>
    EmailEnumeration = 22,     
    /// <summary>
    /// Hvis brukeren prøver å sjekke om telefonen eksisterer
    /// </summary>
    PhoneEnumeration = 23,    
    
    /// <summary>
    /// Bruker rapporterte via "This wasn't me"-lenke at en endring ikke var autorisert.
    /// Kontoen ble låst og pending-endringer ble nullstilt.
    /// </summary>
    UnauthorizedChangeReported = 24,
    
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
