using AFBack.Data;
using AFBack.Features.Auth.Models;
using Microsoft.EntityFrameworkCore;

namespace AFBack.Features.Auth.Repositories;

public class VerificationInfoRepository(AppDbContext context) : IVerificationInfoRepository
{
    /// <inheritdoc />
    public async Task<VerificationInfo?> GetByUserIdAsync(string userId, CancellationToken ct = default) =>
        await context.VerificationInfos.FirstOrDefaultAsync(vi => vi.UserId == userId, ct);
    
    /// <inheritdoc />
    public async Task<VerificationInfo?> GetBySecurityAlertTokenAsync(string token, CancellationToken ct = default) =>
        await context.VerificationInfos.FirstOrDefaultAsync(vi => vi.SecurityAlertToken == token, ct);

    /// <inheritdoc />
    public async Task SaveChangesAsync(CancellationToken ct = default) => await context.SaveChangesAsync(ct);
    
}
