using AFBack.Features.Geography.DTOs;

namespace AFBack.Features.Geography.Services;

public interface ICountryService
{
    /// <summary>
    /// Hent ut alle Countries som CountryResponse
    /// </summary>
    IReadOnlyList<CountryResponse> Countries { get; }
    
    /// <summary>
    /// Henter ut regioner
    /// </summary>
    /// <param name="countryCode">Landet vi skal hente regioner fra</param>
    /// <returns>En liste med Regioner til landet, eller en tom liste</returns>
    List<string> GetRegionsByCountryCode(string countryCode);
}
