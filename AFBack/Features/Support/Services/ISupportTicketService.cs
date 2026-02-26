using AFBack.Common.Results;
using AFBack.Features.Support.DTOs.Requests;
using AFBack.Features.Support.DTOs.Responses;

namespace AFBack.Features.Support.Services;

public interface ISupportTicketService
{
    /// <summary>
    /// Oppretter en Support Ticket med/uten Attachments. Validerer og laster opp filene til S3 hvis filer er vedlagt
    /// </summary>
    /// <param name="userId">Brukerens ID</param>
    /// <param name="ipAddress">IP-addressen</param>
    /// <param name="userAgent">UserAgent - med enhetsinformasjon</param>
    /// <param name="ticketRequest">SupportTicketRequest</param>
    /// <param name="attachments">Bilder som attachments</param>
    /// <param name="ct"></param>
    /// <returns>Result med SupportTicketResponse eller failure</returns>
    Task<Result<SupportTicketResponse>> CreateSupportTicketAsync(string? userId,
        string ipAddress, string userAgent, SupportTicketRequest ticketRequest, List<IFormFile>?
            attachments, CancellationToken ct = default);
}
