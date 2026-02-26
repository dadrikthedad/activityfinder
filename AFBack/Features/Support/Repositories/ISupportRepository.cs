using AFBack.Features.Support.Models;

namespace AFBack.Features.Support.Repositories;

public interface ISupportRepository
{
    /// <summary>
    /// Henter antall UserReports en bruker har opprettet de siste 24 timene
    /// </summary>
    /// <param name="userId">Brukeren som har rapportert</param>
    /// <param name="ct"></param>
    /// <returns>Int med antall rapporteringen</returns>
    Task<int> GetDailyReportCountAsync(string userId, CancellationToken ct = default);
    
    /// <summary>
    /// Sjekker om en bruker har allerede opprettet en UserReport som er pending
    /// </summary>
    /// <param name="submittedByUserId">Brukeren som har rapportert</param>
    /// <param name="reportedUserId">Den rapporterete brukeren</param>
    /// <param name="ct"></param>
    /// <returns>True hvis det finnes en UserReport eller false hvis ikke</returns>
    Task<bool> HasPendingReportAsync(string submittedByUserId, string reportedUserId,
        CancellationToken ct = default);
    
    /// <summary>
    /// Adds and saves a Support ticket
    /// </summary>
    /// <param name="ticket">Support ticket sendt by user</param>
    /// <param name="ct"></param>
    Task CreateSupportTicketAsync(SupportTicket ticket, CancellationToken ct = default);
    
    /// <summary>
    /// Adds and saves a UserReport
    /// </summary>
    /// <param name="report">Report ticket sent by user</param>
    /// <param name="ct"></param>
    Task CreateUserReportAsync(UserReport report, CancellationToken ct = default);
}
