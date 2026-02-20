namespace AFBack.Configurations.Options;

/// <summary>
/// Statiske verdier for token-levetider.
/// Access token er kort for å begrense skadeomfang ved kompromittering.
/// Refresh token er lang for meldingsapp-bruk (alltid innlogget).
/// </summary>
public static class TokenConfig
{
    /// <summary>
    /// Access token levetid. 15 minutter er industristandard.
    /// Kort nok til at revokering via Redis er effektivt.
    /// </summary>
    public const int AccessTokenMinutes = 15;
    
    /// <summary>
    /// Refresh token levetid. 12 måneder for meldingsapp.
    /// Brukeren forblir innlogget så lenge de bruker appen minst én gang i året.
    /// </summary>
    public const int RefreshTokenDays = 365;
    
    /// <summary>
    /// Antall bytes for kryptografisk sikker refresh token.
    /// 64 bytes = 86 tegn i Base64, tilstrekkelig entropi.
    /// </summary>
    public const int RefreshTokenSizeBytes = 64;
    
    /// <summary>
    /// ClockSkew i sekunder. Brukes i JWT-validering og som buffer i Redis blacklist TTL.
    /// Håndterer klokkeforskjeller mellom servere.
    /// </summary>
    public const int ClockSkewSeconds = 30;
}
