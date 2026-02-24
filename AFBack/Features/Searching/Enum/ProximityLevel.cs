namespace AFBack.Features.Searching.Enum;

/// <summary>
/// Bruker for Cursor-søk for å lage en score utifra hvor nærme en bruker er utifra våre lokasjonsegenskaper.
/// Jo lavere, jo nærmere brukeren
/// </summary>
public enum ProximityLevel
{
    PostalCode = 0,
    City = 1,
    Region = 2,
    Country = 3,
    Other = 4
}
