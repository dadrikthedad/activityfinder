using System.ComponentModel.DataAnnotations;
using AFBack.Common.Controllers;
using AFBack.Features.Geography.Services;
using AFBack.Infrastructure.Constants;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace AFBack.Features.Geography.Controllers;

[ApiController]
[EnableRateLimiting(RateLimitPolicies.Public)]
[Route("api/[controller]")]
public class GeographyController(
    ICountryService countryService, 
    IGeoLocationService geoLocationService) : BaseController
{   
    [HttpGet("countries")]
    public IActionResult GetAllCountries() =>
        Ok(countryService.Countries);
    
    [HttpGet("regions/{countryCode}")]
    public IActionResult GetRegionsByCountryCode(
        [FromRoute]
        [Required(ErrorMessage = "Country code is required")]
        string countryCode) =>
            Ok(countryService.GetRegionsByCountryCode(countryCode));
    
    [HttpGet("geolocation")]
    [AllowAnonymous]
    public async Task<IActionResult> GetGeolocation(CancellationToken ct)
    {
        var ipAddress = GetIpAddress();

        var result = await geoLocationService.GetLocationAsync(ipAddress, ct);
        
        if (result.IsFailure)
            return HandleFailure(result);
        
        return Ok(result.Value);
    }
    
}
