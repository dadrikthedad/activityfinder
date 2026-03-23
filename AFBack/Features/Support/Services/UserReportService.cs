using AFBack.Common.Enum;
using AFBack.Common.Results;
using AFBack.Configurations.Options;
using AFBack.Features.FileHandling.Enums;
using AFBack.Features.FileHandling.Services;
using AFBack.Features.Support.DTOs.Requests;
using AFBack.Features.Support.DTOs.Responses;
using AFBack.Features.Support.Models;
using AFBack.Features.Support.Repositories;
using AFBack.Infrastructure.Email;
using AFBack.Infrastructure.Email.Templates;

namespace AFBack.Features.Support.Services;

public class UserReportService(
    ILogger<UserReportService> logger,
    ISupportRepository supportRepository,
    IEmailService emailService,
    IFileOrchestrator fileOrchestrator,
    IConfiguration configuration) : IUserReportService
{
    
    /// <inheritdoc/>
    public async Task<Result<UserReportResponse>> CreateUserReportAsync(string submittedByUserId, 
        UserReportRequest request, List<IFormFile>? attachments, CancellationToken ct = default)
    {
        // ====== Kan ikke rapportere seg selv ======
        if (submittedByUserId == request.ReportedUserId)
            return Result<UserReportResponse>.Failure("You cannot report yourself");

        // ====== Rate limit — maks X rapporter per dag ======
        var dailyCount = await supportRepository.GetDailyReportCountAsync(submittedByUserId, ct);
        if (dailyCount >= SupportTicketFileConfig.MaxUserReportsPerDay)
            return Result<UserReportResponse>.Failure("Daily report limit reached. Please try again tomorrow.",
                AppErrorCode.TooManyRequests);

        // ====== Sjekk duplikat — allerede rapportert samme bruker med pending ======
        var existingReport = await supportRepository.HasPendingReportAsync(submittedByUserId, 
            request.ReportedUserId, ct);
        if (existingReport)
            return Result<UserReportResponse>.Failure("You already have a pending report for this user");

        // Opprett UserReport
        var report = new UserReport
        {
            SubmittedByUserId = submittedByUserId,
            ReportedUserId = request.ReportedUserId,
            Reason = request.Reason,
            Description = request.Description,
        };

        // Validerer og laster opp filer
        if (attachments is { Count: > 0 } )
        {
            if (attachments.Count > SupportTicketFileConfig.TicketMaxFileCount)
                return Result<UserReportResponse>.Failure(
                    $"Maximum {SupportTicketFileConfig.TicketMaxFileCount} files allowed");

            var attachmentResult = await ValidateAndUploadAttachmentsAsync(attachments, ct);
            if (attachmentResult.IsFailure)
                return Result<UserReportResponse>.Failure(attachmentResult.Error);

            report.Attachments = attachmentResult.Value!;
        }

        // Lagre i database
        try
        {
            await supportRepository.CreateUserReportAsync(report, ct);

            logger.LogInformation(
                "User report created: {ReportId} by {ReporterId} against {ReportedId} for {Reason}",
                report.Id, submittedByUserId, request.ReportedUserId, request.Reason);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to save user report. Cleaning up uploaded files");
            var keys = report.Attachments.Select(a => a.StorageKey).ToList();
            await fileOrchestrator.TryCleanupFilesAsync(keys, BlobContainer.PrivateFiles, ct);
            return Result<UserReportResponse>.Failure(
                "Failed to submit report. Please try again.");
        }

        // Varsle moderator-team
        await SendEmailNotificationsAsync(report);

        return Result<UserReportResponse>.Success(new UserReportResponse
        {
            UserReportId = report.Id,
            NumberOfAttachments = attachments?.Count ?? 0
        });
    }

    private async Task<Result<List<UserReportAttachment>>> ValidateAndUploadAttachmentsAsync(
        List<IFormFile> attachments, CancellationToken ct)
    {
        var uploaded = new List<UserReportAttachment>();

        foreach (var file in attachments)
        {
            // Bruker samme validering som support attachments
            var result = await fileOrchestrator.UploadSupportAttachmentAsync(file, ct);

            if (result.IsFailure)
            {
                var keys = uploaded.Select(a => a.StorageKey).ToList();
                await fileOrchestrator.TryCleanupFilesAsync(keys, BlobContainer.PrivateFiles, ct);
                return Result<List<UserReportAttachment>>.Failure(result.Error);
            }

            // Map fra SupportAttachment til UserReportAttachment
            uploaded.Add(new UserReportAttachment
            {
                OriginalFileName = result.Value!.OriginalFileName,
                ContentType = result.Value!.ContentType,
                FileExtension = result.Value!.FileExtension,
                FileSize = result.Value!.FileSize,
                StorageKey = result.Value!.StorageKey
            });
        }

        return Result<List<UserReportAttachment>>.Success(uploaded);
    }

    /// <summary>
    /// Sender e-postvarsler til support-teamet at ny UserReport har blitt innsendt
    /// </summary>
    /// <param name="report">UserReport</param>
    private async Task SendEmailNotificationsAsync(UserReport report)
    {
        try
        {
            // Varselsmail til support-teamet
            var notificationBody = SupportTicketTemplates.UserReportNotification(report);
            await emailService.SendAsync(configuration["Email:SupportAddress"]!, notificationBody);

            logger.LogInformation("Notification email sent for user report {ReportId}", report.Id);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to send notification email for user report {ReportId}", report.Id);
        }
    }
}
