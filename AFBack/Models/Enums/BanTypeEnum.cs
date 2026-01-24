namespace AFBack.Constants;

public enum BanType
{
    Unknown = 0,
    
    // ======================== Scope ========================
    UserBan = 1,           // Hele brukerkontoen
    IPBan = 2,             // IP-adresse
    DeviceBan = 3,         // Spesifikt device
    
    // ======================== Severity ========================
    Temporary = 10,        // Midlertidig ban
    Permanent = 11,        // Permanent ban
    
    // ======================== Type ========================
    AccountSuspension = 20,  // Suspendert, kan appeales
    Shadow = 21,            // Shadowban (brukeren vet ikke de er bannet)
}
