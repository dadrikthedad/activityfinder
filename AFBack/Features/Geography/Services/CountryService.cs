using AFBack.Features.Geography.DTOs;
using CountryData.Standard;

namespace AFBack.Features.Geography.Services;

public class CountryService : ICountryService
{
    private readonly ILogger<CountryService> _logger;
    private readonly CountryHelper _countryHelper;
    private List<CountryResponse> _countries = [];
    
    /// <inheritdoc />
    public IReadOnlyList<CountryResponse> Countries => _countries;
    
    /// <summary>
    /// Laster inn Countries fra JSON ved oppstart
    /// </summary>
    public CountryService(ILogger<CountryService> logger)
    {
        _logger = logger;
        _countryHelper = new CountryHelper();
        LoadCountries();
    }
    
    /// <summary>
    /// Laster alle landene fra Json ved oppstart og legger det inn i en liste med CountryResponses
    /// </summary>
    private void LoadCountries()
    {
        try
        {
            // Henter countries fra JSON
            var countries = _countryHelper.GetCountryData();
            
            // Oppretter en liste med CountryResponses for frontend
            _countries = countries
                .Where(c => 
                    !string.IsNullOrWhiteSpace(c.CountryShortCode) 
                    && !string.IsNullOrWhiteSpace(c.CountryName))
                .Select(c => new CountryResponse
                {
                    Code = c.CountryShortCode.ToUpper(),
                    Name = c.CountryName
                })
                .ToList();
            
            _logger.LogInformation(" Loaded {Count} countries from CountryData.Standard", _countries.Count);
        }
        catch (Exception ex)
        {
            _logger.LogError("Failed to load countries: {Error}", ex.Message);
        }
    }
    
    
    /// <inheritdoc />
    public List<string> GetRegionsByCountryCode(string countryCode)
    {
        // Sjekker at countryCode inneholder data hvis ikke early return - Guard Claus
        if (string.IsNullOrWhiteSpace(countryCode)) 
            return [];
        
        // Henter regioner
        var regions = _countryHelper
            .GetRegionByCountryCode(countryCode.Trim().ToUpper());
        if (regions == null)
            return [];
        
        // Returner regionene som et navn
        return regions
            .Select(r => r.Name)
            .Distinct()
            .ToList();
    }
}
