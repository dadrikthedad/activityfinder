using AFBack.Common.Controllers;
using AFBack.Configurations.Options;
using AFBack.Features.Support.DTOs.Requests;
using AFBack.Features.Support.DTOs.Responses;
using AFBack.Features.Support.Services;
using AFBack.Infrastructure.Constants;
using AFBack.Infrastructure.Extensions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace AFBack.Features.Support.Controllers;

[EnableRateLimiting(RateLimitPolicies.Auth)]
[ApiController]
[Route("api/[controller]")]
[Authorize]
public class SupportController(
    ISupportTicketService supportTicketService,
    IUserReportService userReportService) : BaseController
{
    /// <summary>
    /// Creates a new support ticket with optional file attachments.
    /// </summary>
    /// <param name="ticketRequest">The support ticket request containing email, title, category, and description.</param>
    /// <param name="attachments">Optional list of image file attachments (max 5 files, 5MB each).</param>
    /// <returns>Ok 200 med SupportTicketResponse</returns>
    [HttpPost]
    [AllowAnonymous]
    [Consumes("multipart/form-data")]
    [RequestSizeLimit(SupportTicketFileConfig.TicketMaxTotalRequestSize)]
    [RequestFormLimits(MultipartBodyLengthLimit = SupportTicketFileConfig.TicketMaxTotalRequestSize)]
    [ProducesResponseType(typeof(SupportTicketResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<IActionResult> CreateSupportTicket(
        [FromForm] SupportTicketRequest ticketRequest,
        [FromForm] List<IFormFile>? attachments)
    {
        var userId = User.GetUserIdOrDefault();
        var ipAddress = GetIpAddress();
        var userAgent = Request.Headers.UserAgent.ToString();
        var result = await supportTicketService.CreateSupportTicketAsync(userId, ipAddress, userAgent,
        ticketRequest, attachments);
        
        if (result.IsFailure)
            return HandleFailure(result);


        return Ok(result.Value);
    }

    /// <summary>
    /// Creates a new user report against another user with optional file attachments.
    /// Requires authentication. Rate limited per user per day.
    /// </summary>
    /// <param name="request">The report request containing reported user ID, reason, and description.</param>
    /// <param name="attachments">Optional list of image file attachments (max 5 files, 5MB each).</param>
    /// <returns>Ok 200 med UserReportResponse</returns>
    [HttpPost("report")]
    [Consumes("multipart/form-data")]
    [RequestSizeLimit(SupportTicketFileConfig.TicketMaxTotalRequestSize)]
    [RequestFormLimits(MultipartBodyLengthLimit = SupportTicketFileConfig.TicketMaxTotalRequestSize)]
    [ProducesResponseType(typeof(UserReportResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> CreateUserReport(
        [FromForm] UserReportRequest request,
        [FromForm] List<IFormFile>? attachments)
    {
        var userId = User.GetUserId();
        var result = await userReportService.CreateUserReportAsync(userId, request, attachments);

        if (result.IsFailure)
            return HandleFailure(result);

        return Ok(result.Value);
    }
}
