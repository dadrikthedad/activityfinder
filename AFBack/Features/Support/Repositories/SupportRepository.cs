using AFBack.Data;
using AFBack.Features.Support.Enums;
using AFBack.Features.Support.Models;
using Microsoft.EntityFrameworkCore;

namespace AFBack.Features.Support.Repositories;

public class SupportRepository(AppDbContext context) : ISupportRepository
{   
    
    // ================================== GET ==================================
    /// <inheritdoc/>
    public async Task<int> GetDailyReportCountAsync(string userId, CancellationToken ct = default)
    {
        var since = DateTime.UtcNow.AddHours(-24);
        return await context.UserReports
            .CountAsync(r => r.SubmittedByUserId == userId && r.CreatedAt >= since, ct);
    }
    /// <inheritdoc/>
    public async Task<bool> HasPendingReportAsync(string submittedByUserId, string reportedUserId, 
        CancellationToken ct = default) => await context.UserReports
            .AnyAsync(r => r.SubmittedByUserId == submittedByUserId 
                           && r.ReportedUserId == reportedUserId 
                           && r.Status == UserReportStatus.Pending, ct);
    
    
    // ================================== CREATE ==================================
    /// <inheritdoc/>
    public async Task CreateSupportTicketAsync(SupportTicket ticket, CancellationToken ct = default)
    {
        await context.SupportTickets.AddAsync(ticket, ct);
        await context.SaveChangesAsync(ct);
    }
    
    /// <inheritdoc/>
    public async Task CreateUserReportAsync(UserReport report, CancellationToken ct = default)
    {
        context.UserReports.Add(report);
        await context.SaveChangesAsync(ct);
    }
}
