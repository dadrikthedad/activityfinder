using CountryData.Standard;
using Microsoft.Extensions.Logging;

namespace AFBack.Models;

public class CountryService
{
    private readonly ILogger<CountryService> _logger;
    private readonly CountryHelper _countryHelper;
    private Dictionary<string, string> _codeToName = new();
    private HashSet<string> _validCountryCodes = new();

    public CountryService(ILogger<CountryService> logger)
    {
        _logger = logger;
        _countryHelper = new CountryHelper();
        LoadCountries();
    }

    private void LoadCountries()
    {
        try
        {
            var countries = _countryHelper.GetCountryData();

            _codeToName = countries
                .Where(c => !string.IsNullOrWhiteSpace(c.CountryShortCode) && !string.IsNullOrWhiteSpace(c.CountryName))
                .ToDictionary(
                    c => c.CountryShortCode.ToUpper(),
                    c => c.CountryName
                );

            _validCountryCodes = new HashSet<string>(_codeToName.Keys);

            _logger.LogInformation("✅ Loaded {Count} countries from CountryData.Standard", _codeToName.Count);
        }
        catch (Exception ex)
        {
            _logger.LogError("❌ Failed to load countries: {Error}", ex.Message);
        }
    }

    public IEnumerable<object> GetAllCountries() =>
        _codeToName.Select(kvp => new { Code = kvp.Key, Name = kvp.Value });

    public string? GetCountryNameFromCode(string code)
    {
        return _codeToName.TryGetValue(code.Trim().ToUpper(), out var name) ? name : null;
    }

    public bool IsValidCountryCode(string code)
    {
        return _validCountryCodes.Contains(code.Trim().ToUpper());
    }

    public List<string> GetRegionsByCountryCode(string code)
    {
        if (string.IsNullOrWhiteSpace(code)) return new();

        var regions = _countryHelper.GetRegionByCountryCode(code.Trim().ToUpper());
        return regions?.Select(r => r.Name).Distinct().ToList() ?? new();
    }
}