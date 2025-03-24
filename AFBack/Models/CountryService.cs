using System.Text.Json;

namespace AFBack.Models;

public class CountryService
{
    private readonly ILogger<CountryService> _logger;
    private Dictionary<string, string> _codeToName = new(); // "NO" -> "Norway"
    private HashSet<string> _validCountryCodes = new();   

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

            _codeToName = countriesRaw
                .Where(c => !string.IsNullOrWhiteSpace(c.Cca2) && !string.IsNullOrWhiteSpace(c.Name.Common))
                .ToDictionary(
                    c => c.Cca2.ToUpper(), // "NO"
                    c => c.Name.Common     // "Norway"
                );

            _validCountryCodes = new HashSet<string>(_codeToName.Keys);

            _logger.LogInformation("Tilgjengelige landkoder: {Codes}", string.Join(", ", _validCountryCodes));
            _logger.LogInformation("✅ Loaded {Count} countries from REST Countries API.", _codeToName.Count);

        }
        catch (Exception ex)
        {
            _logger.LogError("❌ Failed to load countries from API: {Error}", ex.Message);
        }
    }
    

    public IEnumerable<object> GetAllCountries() =>
        _codeToName.Select(kvp => new { Code = kvp.Key, Name = kvp.Value });
    
    public string? GetCountryNameFromCode(string code)
    {
        _logger.LogInformation("Forespurt landkode: {Code}", code);
        return _codeToName.TryGetValue(code.Trim().ToUpper(), out var name) ? name : null;
    }

    public bool IsValidCountryCode(string code)
    {
        return _validCountryCodes.Contains(code.Trim().ToUpper());
    }

    private class RestCountry
    {
        public NameInfo Name { get; set; } = new();
        public string Cca2 { get; set; } = string.Empty; // <-- LEGG TIL DENNE!

        public class NameInfo
        {
            public string Common { get; set; } = string.Empty;
        }
    }
}