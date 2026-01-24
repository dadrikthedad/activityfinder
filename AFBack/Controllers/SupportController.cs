using AFBack.Data;
using AFBack.Features.Cache;
using AFBack.Features.Cache.Interface;
using AFBack.Infrastructure.Services;
using AFBack.Models;
using AFBack.Services;
using Microsoft.AspNetCore.Mvc;

namespace AFBack.Controllers;

[ApiController]
[Route("api/[controller]")]
public class SupportController(
    ApplicationDbContext context,
    ILogger<SupportController> logger,
    SupportService supportService,
    IUserCache userCache,
    ResponseService responseService)
    : BaseController<SupportController>(context, logger, userCache, responseService)
{
    // Loggeren

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
        
            Logger.LogInformation("Report submitted - DeviceId: {DeviceId}, Platform: {Platform}, Type: {Type}", 
                deviceId, platform, request.Type);

            var userId = GetUserId();
            var reportId = await supportService.CreateReportAsync(request, userId);
            
            return Ok(new { 
                ReportId = reportId, 
                Message = "Report submitted successfully",
                SubmittedAt = DateTime.UtcNow
            });
        }
        catch (Exception ex)
        {
            var deviceId = Request.Headers["X-Device-ID"].FirstOrDefault();
            Logger.LogError("Report submission failed - DeviceId: {DeviceId}, Error: {Error}", deviceId, ex.Message);
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
    