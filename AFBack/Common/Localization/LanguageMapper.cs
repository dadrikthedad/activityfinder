namespace AFBack.Common.Localization;

/// <summary>
/// Enkel metode for å mappe til countryCode fra Country
/// </summary>
public static class LanguageMapper
{
    private static readonly Dictionary<string, string> CountryToLanguage = new(StringComparer.OrdinalIgnoreCase)
    {
        ["Norway"] = "nb",
        ["Sweden"] = "sv",
        ["Denmark"] = "da",
        ["Germany"] = "de",
        ["France"] = "fr",
        ["Spain"] = "es",
        ["Italy"] = "it",
        ["Netherlands"] = "nl",
        ["Portugal"] = "pt",
        ["Japan"] = "ja",
        ["China"] = "zh",
        ["South Korea"] = "ko"
    };
    
    /// <summary>
    /// Omgjør en streng med Country til CountryCode
    /// </summary>
    /// <param name="country">Country som string</param>
    /// <returns>CountryCode eks: "nb"</returns>
    public static string FromCountry(string country)
        => CountryToLanguage.GetValueOrDefault(country, "en");
}
