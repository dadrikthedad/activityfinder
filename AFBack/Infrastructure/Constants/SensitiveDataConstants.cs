namespace AFBack.Infrastructure.Constants;

/// <summary>
/// Denne klassen så samler vi sensitive stikkord som sikrer at vi ikke logger senstiiv informasjon både i
/// AppInsights og annen middleware
/// </summary>
public static class SensitiveDataConstants
{
    /// <summary>
    /// Alle senstive ord vi sjekker
    /// </summary>
    public static readonly HashSet<string> SensitiveFields = new(StringComparer.OrdinalIgnoreCase)
    {
        // Passord
        "password",
        "oldPassword",
        "newPassword",
        "confirmPassword",
        "currentPassword",

        // Tokens og nøkler
        "token",
        "accessToken",
        "refreshToken",
        "apiKey",
        "secret",
        "apiSecret",

        // Betalingsinformasjon
        "creditCard",
        "cardNumber",
        "cvv",
        "cvc",

        // Personopplysninger
        "ssn",
        "fodselsnummer",
        "personalNumber",
        "nationalId"
    };
    
    /// <summary>
    /// Sjekker om innsendt parameter er senstivt og må filtreres
    /// </summary>
    /// <param name="fieldName"></param>
    /// <returns></returns>
    public static bool IsSensitive(string fieldName) => SensitiveFields.Contains(fieldName);
}
