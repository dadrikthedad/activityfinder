using AFBack.Common.Results;
using AFBack.Configurations.Options;
using AFBack.Features.FileHandling.Enums;
using AFBack.Features.FileHandling.Services;
using AFBack.Features.Support.DTOs.Requests;
using AFBack.Features.Support.DTOs.Responses;
using AFBack.Features.Support.Models;
using AFBack.Features.Support.Repositories;
using AFBack.Infrastructure.Email;
using AFBack.Infrastructure.Email.Enums;
using AFBack.Infrastructure.Email.Models;
using AFBack.Infrastructure.Email.Templates;
using AFBack.Infrastructure.Security.Services;

namespace AFBack.Features.Support.Services;

public class SupportTicketService(
    ILogger<SupportTicketService> logger,
    ISupportRepository supportRepository,
    IEmailService emailService,
    IFileOrchestrator fileOrchestrator,
    IRateLimitGuardService limitGuardService,
    IEmailRateLimitService emailRateLimitService,
    IConfiguration configuration) : ISupportTicketService
{

    /// <inheritdoc/>
    public async Task<Result<SupportTicketResponse>> CreateSupportTicketAsync(string? userId,
        string ipAddress, string userAgent, SupportTicketRequest ticketRequest, List<IFormFile>?
            attachments, CancellationToken ct = default)
    {
        // ====== Rate limit — stopp spam av eposter ======
        var rateLimitResult = await limitGuardService.CheckEmailRateLimitAsync(EmailType.SupportTicket,
            ticketRequest.Email, ipAddress);
        if (rateLimitResult.IsFailure)
            return Result<SupportTicketResponse>.Failure(rateLimitResult.Error, rateLimitResult.ErrorType);

        // Oppretter en SupportTicket
        var ticket = new SupportTicket
        {
            SubmittedByUserId = userId,
            Email = ticketRequest.Email,
            Type = ticketRequest.Type,
            Title = ticketRequest.Title,
            Description = ticketRequest.Description,
            StepsToReproduce = ticketRequest.StepsToReproduce,
            ExpectedBehavior = ticketRequest.ExpectedBehavior,
            ActualBehavior = ticketRequest.ActualBehavior,
            IpAddress = ipAddress,
            UserAgent = userAgent
        };

        // Validerer og laster opp filer til S3
        if (attachments != null && attachments.Count > 0)
        {
            // Sjekk maks antall filer
            if (attachments.Count > SupportTicketFileConfig.TicketMaxFileCount)
                return Result<SupportTicketResponse>.Failure(
                    $"Maximum {SupportTicketFileConfig.TicketMaxFileCount} files allowed");

            // Validerer og laster opp filer
            var attachmentResult = await ValidateAndUploadAttachmentsAsync(attachments, ct);
            if (attachmentResult.IsFailure)
                return Result<SupportTicketResponse>.Failure(attachmentResult.Error);

            ticket.Attachments = attachmentResult.Value!;
        }

        // Lagre i database
        try
        {
            await supportRepository.CreateSupportTicketAsync(ticket, ct);

            logger.LogInformation(
                "Support ticket created: {TicketId} from {Email} with {AttachmentCount} attachments",
                ticket.Id, ticket.Email, ticket.Attachments.Count);
        }
        catch (Exception ex)
        {
            // Database feilet - slett opplastede filer
            logger.LogError(ex, "Failed to save support ticket. Cleaning up uploaded files.");
            var keys = ticket.Attachments.Select(a => a.StorageKey).ToList();
            await fileOrchestrator.TryCleanupFilesAsync(keys, BlobContainer.PrivateFiles, ct);
            return Result<SupportTicketResponse>.Failure("Failed to create support ticket. Please try again.");
        }

        // Send e-poster (ikke kritisk - feiler stille)
        await SendEmailNotificationsAsync(ipAddress, ticket.Email, ticket);


        return Result<SupportTicketResponse>.Success(new SupportTicketResponse
        {
            SupportTicketId = ticket.Id,
            NumberOfAttachments = attachments?.Count ?? 0
        });
    }

    /// <summary>
    /// Iterer igjennom hver fil, validerer og laster opp til S3 Bucket. Hvis en fil feiler så utfører vi
    /// CleanupUploadedFilesAsync som sletter alle filene
    /// </summary>
    /// <param name="attachments">Alle attachmentene vi skal validere og laste opp</param>
    /// <param name="ct"></param>
    /// <returns>Result med en liste med SupportAttachments eller Failure med Error</returns>
    private async Task<Result<List<SupportAttachment>>> ValidateAndUploadAttachmentsAsync(
        List<IFormFile> attachments,
        CancellationToken ct)
    {
        // En liste vi legger attachmentene til etter vellykket lagring
        var uploadedAttachments = new List<SupportAttachment>();

        // Iterer igjennom hver fil
        foreach (var file in attachments)
        {
            var result = await fileOrchestrator.UploadSupportAttachmentAsync(file, ct);

            if (result.IsFailure)
            {
                // Rydd opp alle filer
                var keys = uploadedAttachments.Select(a => a.StorageKey).ToList();
                await fileOrchestrator.TryCleanupFilesAsync(keys, BlobContainer.PrivateFiles, ct);
                return Result<List<SupportAttachment>>.Failure(result.Error);
            }

            uploadedAttachments.Add(result.Value!);
        }

        return Result<List<SupportAttachment>>.Success(uploadedAttachments);
    }


    /// <summary>
    /// Sender e-postvarsler til brukerne og support-teamet at ny epost har kommet
    /// </summary>
    /// <param name="ipAddress">IP-adrresen for ratelimit</param>
    /// <param name="email">Eposten til brukerne</param>
    /// <param name="ticket">Opprettet support ticket</param>
    private async Task SendEmailNotificationsAsync(string ipAddress, string email, SupportTicket ticket)
    {
        try
        {
            // Bekreftelsesmail til brukeren
            var confirmationBody = SupportTicketTemplates.SupportTicketConfirmation(ticket);
            var confirmationResult = await emailService.SendAsync(email, confirmationBody);
            if (confirmationResult.IsSuccess)
                emailRateLimitService.RegisterEmailSent(EmailType.SupportTicket, email, ipAddress);

            // Varselsmail til support-teamet
            var notificationBody = SupportTicketTemplates.SupportTicketNotification(ticket);
            await emailService.SendAsync(configuration["Email:SupportAddress"]!, notificationBody);

            logger.LogInformation("Confirmation email sent for ticket {TicketId}", ticket.Id);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to send confirmation email for ticket {TicketId}", ticket.Id);
        }
    }
}

