using System.Text.Json;
using AFBack.DTOs.Security;

namespace AFBack.Services.User;

public class GeolocationService
{
    private readonly HttpClient _httpClient;
    private readonly ILogger<GeolocationService> _logger;
    
    public GeolocationService(HttpClient httpClient, ILogger<GeolocationService> logger)
    {
        _httpClient = httpClient;
        _logger = logger;
        _httpClient.Timeout = TimeSpan.FromSeconds(5);
    }
    
    public async Task<GeolocationResultDTO> GetLocationAsync(string ipAddress)
    {
        try
        {
            var response = await _httpClient.GetStringAsync($"https://ipwho.is/{ipAddress}");
            var locationData = JsonSerializer.Deserialize<JsonDocument>(response);
            
            var root = locationData?.RootElement;
            if (root?.GetProperty("success").GetBoolean() != true)
                return new GeolocationResultDTO();
            
            return new GeolocationResultDTO
            {
                City = root?.TryGetProperty("city", out var cityProp) == true ? cityProp.GetString() : null,
                Region = root?.TryGetProperty("region", out var regionProp) == true ? regionProp.GetString() : null,
                Country = root?.TryGetProperty("country", out var countryProp) == true ? countryProp.GetString() : null,
                Success = true
            };
        }
        catch (Exception ex)
        {
            _logger.LogWarning("Geolocation failed for IP {IP}: {Error}", ipAddress, ex.Message);
            return new GeolocationResultDTO();
        }
    }
}