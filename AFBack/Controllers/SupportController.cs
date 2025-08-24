using AFBack.Data;
using AFBack.Models;
using AFBack.Services;
using Microsoft.AspNetCore.Mvc;

namespace AFBack.Controllers;

[ApiController]
[Route("api/[controller]")]
public class SupportController : BaseController
{
    private readonly SupportService _supportService;
    private readonly ApplicationDbContext _context;
    // Loggeren
    private readonly ILogger<SupportController> _logger;
        
    public SupportController(ApplicationDbContext context, ILogger<SupportController> logger, SupportService supportService)
    {
            _supportService = supportService;
            _context = context;
            _logger = logger;
    }

    [HttpPost("report")]
    public async Task<IActionResult> SubmitReport([FromBody] ReportRequestDTO request)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        try
        {
            // ✅ Legg til device info logging for ban system
            var deviceId = Request.Headers["X-Device-ID"].FirstOrDefault();
            var platform = Request.Headers["X-Device-Platform"].FirstOrDefault();
        
            _logger.LogInformation("Report submitted - DeviceId: {DeviceId}, Platform: {Platform}, Type: {Type}", 
                deviceId, platform, request.Type);

            var userId = GetUserId();
            var reportId = await _supportService.CreateReportAsync(request, userId);
            
            return Ok(new { 
                ReportId = reportId, 
                Message = "Report submitted successfully",
                SubmittedAt = DateTime.UtcNow
            });
        }
        catch (Exception ex)
        {
            var deviceId = Request.Headers["X-Device-ID"].FirstOrDefault();
            _logger.LogError("Report submission failed - DeviceId: {DeviceId}, Error: {Error}", deviceId, ex.Message);
            return StatusCode(500, new { Message = "An error occurred while processing your report" });
        }
    }

    // [HttpGet("report/{id}")]
    // public async Task<IActionResult> GetReport(Guid id)
    // {
    //     try 
    //     {
    //         var userId = GetUserId();
    //         var report = await _supportService.GetReportAsync(id, userId);
    //             
    //         if (report == null)
    //             return NotFound(new { Message = "Report not found" });
    //             
    //         return Ok(report);
    //     }
    //     catch (Exception ex)
    //     {
    //         return StatusCode(500, new { Message = "An error occurred while retrieving the report" });
    //     }
    // }

    // [HttpGet("my-reports")]
    // public async Task<IActionResult> GetMyReports()
    // {
    //     try
    //     {
    //         var userId = GetUserId();
    //         if (userId == null)
    //             return Unauthorized(new { Message = "You must be logged in to view your reports" });
    //             
    //         var reports = await _supportService.GetUserReportsAsync(userId.Value);
    //         return Ok(reports);
    //     }
    //     catch (Exception ex)
    //     {
    //         return StatusCode(500, new { Message = "An error occurred while retrieving reports" });
    //     }
    // }
}    
    