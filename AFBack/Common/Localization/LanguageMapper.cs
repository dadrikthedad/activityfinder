namespace AFBack.Common.Localization;

/// <summary>
/// Mapper ISO 3166-1 alpha-2 landkode til BCP 47 språkkode.
/// </summary>
public static class LanguageMapper
{
    private static readonly Dictionary<string, string> CountryToLanguage = new(StringComparer.OrdinalIgnoreCase)
    {
        ["NO"] = "nb",
        ["SE"] = "sv",
        ["DK"] = "da",
        ["DE"] = "de",
        ["FR"] = "fr",
        ["ES"] = "es",
        ["IT"] = "it",
        ["NL"] = "nl",
        ["PT"] = "pt",
        ["JP"] = "ja",
        ["CN"] = "zh",
        ["KR"] = "ko",
        ["GB"] = "en",
        ["US"] = "en",
        ["AU"] = "en",
    };

    /// <summary>
    /// Returnerer BCP 47 språkkode for en ISO 3166-1 alpha-2 landkode (f.eks. "NO" → "nb").
    /// Ukjente koder gir fallback til "en".
    /// </summary>
    /// <param name="countryCode">ISO 3166-1 alpha-2 landkode, f.eks. "NO"</param>
    /// <returns>BCP 47 språkkode, f.eks. "nb"</returns>
    public static string FromCountry(string countryCode)
        => CountryToLanguage.GetValueOrDefault(countryCode, "en");
}
