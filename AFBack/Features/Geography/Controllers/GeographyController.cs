using System.ComponentModel.DataAnnotations;
using AFBack.Features.Geography.Services;
using AFBack.Infrastructure.Constants;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace AFBack.Features.Geography.Controllers;

[ApiController]
[EnableRateLimiting(RateLimitPolicies.Public)]
[Route("api/[controller]")]
public class GeographyController(ICountryService countryService) : ControllerBase
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
    
}
