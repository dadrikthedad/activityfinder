using System.ComponentModel.DataAnnotations;
using AFBack.Features.Geography.Services;
using Microsoft.AspNetCore.Mvc;

namespace AFBack.Features.Geography.Controllers;

[ApiController]
[Route("api/[controller]")]
public class GeographyController(ICountryService countryService) : ControllerBase
{
    // TODO: Må ha rate limiting her
    
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
