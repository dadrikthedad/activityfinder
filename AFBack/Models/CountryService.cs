using System.Text.Json;

namespace AFBack.Models;

public class CountryService
{
    private readonly ILogger<CountryService> _logger;
    private List<string> _cachedCountries = new();

    public CountryService(ILogger<CountryService> logger)
    {
        _logger = logger;
        LoadCountriesFromApi(); // ✅ Bruker API i stedet for lokal fil
    }

    private void LoadCountriesFromApi()
    {
        try
        {
            using var client = new HttpClient();
            var response = client.GetStringAsync("https://restcountries.com/v3.1/all").Result;

            var countriesRaw = JsonSerializer.Deserialize<List<RestCountry>>(response);

            _cachedCountries = countriesRaw?
                .Select(c => c.Name.Common)
                .Where(name => !string.IsNullOrWhiteSpace(name))
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .OrderBy(n => n)
                .ToList() ?? new();

            _logger.LogInformation("✅ Loaded {Count} countries from REST Countries API.", _cachedCountries.Count);
        }
        catch (Exception ex)
        {
            _logger.LogError("❌ Failed to load countries from API: {Error}", ex.Message);
        }
    }

    public bool IsValidCountry(string input)
    {
        return _cachedCountries.Contains(input.Trim(), StringComparer.OrdinalIgnoreCase);
    }

    public string? GetCanonicalName(string input)
    {
        input = input.Replace("-", " ").Trim();
        return _cachedCountries.FirstOrDefault(c =>
            string.Equals(c, input.Trim(), StringComparison.OrdinalIgnoreCase));
    }

    public IEnumerable<string> GetAllCountries() => _cachedCountries;

    private class RestCountry
    {
        public NameInfo Name { get; set; } = new();
        public class NameInfo
        {
            public string Common { get; set; } = string.Empty;
        }
    }
}