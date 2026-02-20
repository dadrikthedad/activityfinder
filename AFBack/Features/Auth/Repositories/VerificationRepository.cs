using AFBack.Data;
using AFBack.Features.Auth.Models;
using Microsoft.EntityFrameworkCore;

namespace AFBack.Features.Auth.Repositories;

public class VerificationRepository(AppDbContext context) : IVerificationRepository
{
    /// <inheritdoc />
    public async Task<VerificationInfo?> GetByUserIdAsync(string userId) =>
        await context.VerificationInfos.FirstOrDefaultAsync(vi => vi.UserId == userId);
    
    /// <inheritdoc />
    public async Task<VerificationInfo?> GetBySecurityAlertTokenAsync(string token) =>
        await context.VerificationInfos.FirstOrDefaultAsync(vi => vi.SecurityAlertToken == token);

    /// <inheritdoc />
    public async Task SaveChangesAsync() => await context.SaveChangesAsync();
    
}
