using AFBack.Common.Results;
using AFBack.Features.Geography.DTOs;

namespace AFBack.Features.Geography.Services;

public class GeolocationService(
    HttpClient httpClient, 
    ILogger<GeolocationService> logger) : IGeoLocationService
{
    
    /// <inheritdoc />
    public async Task<Result<GeolocationResponse>> GetLocationAsync(string ipAddress, CancellationToken ct = default)
    {
        try
        {
            var response = await httpClient.GetFromJsonAsync<IpWhoIsResponse>(ipAddress, ct);
            if (response is not { Success: true })
            {
                logger.LogWarning("Geolocation lookup failed for IP {IP}: {Message}",
                    ipAddress, response?.Message ?? "Unknown error");
                return Result<GeolocationResponse>.Failure("Error retrieving location from IpWhoIsResponse");
            }
            
            return Result<GeolocationResponse>.Success(new GeolocationResponse
            {
                City = response.City,
                Region = response.Region,
                Country = response.Country

            });
        }
        catch (Exception ex)
        {
            logger.LogWarning("Geolocation request failed for IP {IP}: {Error}", ipAddress, ex.Message);
            return Result<GeolocationResponse>.Failure("Geolocation service unavailable");
        }
    }
}
