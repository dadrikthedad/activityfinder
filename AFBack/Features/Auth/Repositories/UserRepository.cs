using AFBack.Common.DTOs;
using AFBack.Data;
using AFBack.Features.Auth.Models;
using Microsoft.EntityFrameworkCore;

namespace AFBack.Features.Auth.Repositories;

public class UserRepository(AppDbContext context) : IUserRepository
{   
    
    // ======================== GET-operasjoner ========================
    /// <inheritdoc />
    public async Task<AppUser?> FindByPhoneAsync(string phoneNumber, CancellationToken ct = default) 
        => await context.Users
            .FirstOrDefaultAsync(u => u.PhoneNumber == phoneNumber, ct);
    
    /// <inheritdoc />
    public async Task<bool> UserExistsAsync(string userId, CancellationToken ct = default) =>
        await context.AppUsers.AnyAsync(u => u.Id == userId, ct);
    
    
    // ======================== User Summary ========================
    
    /// <inheritdoc />
    public async Task<UserSummaryDto?> GetUserSummaryAsync(string userId, CancellationToken ct = default) =>
        await context.AppUsers
            .AsNoTracking()
            .Where(u => u.Id == userId)
            .Select(u => new UserSummaryDto
            {
                Id = userId,
                FullName = u.FullName,
                ProfileImageUrl = u.ProfileImageUrl
            })
            .FirstOrDefaultAsync(ct);
            
    
    /// <inheritdoc />
    public async Task<Dictionary<string, UserSummaryDto>> GetUserSummariesAsync(List<string> userIds, 
        CancellationToken ct = default)
        => await context.AppUsers
                .AsNoTracking()
                .Where(u => userIds.Contains(u.Id))
                .Select(u => new UserSummaryDto
                {
                    Id = u.Id,
                    FullName = u.FullName,
                    ProfileImageUrl = u.ProfileImageUrl
                })
                .ToDictionaryAsync(u => u.Id, ct);
    
    /// <inheritdoc />
    public async Task<List<AppUser>> GetUnverifiedUsersAsync(
        DateTime nothingVerifiedCutoff, 
        DateTime partiallyVerifiedCutoff, 
        CancellationToken ct = default) 
        => await context.Users
            .Where(u => 
                (!u.EmailConfirmed && !u.PhoneNumberConfirmed && u.CreatedAt < nothingVerifiedCutoff)
                || (u.EmailConfirmed && !u.PhoneNumberConfirmed && u.CreatedAt < partiallyVerifiedCutoff))
            .ToListAsync(ct);
    
    /// <inheritdoc />
    public async Task<AppUser?> GetUserWithProfileAndSettingsAsync(string userId, CancellationToken ct = default) =>
        await context.Users
            .AsNoTracking()
            .Include(u => u.UserProfile)
            .Include(u => u.UserSettings)
            .FirstOrDefaultAsync(u => u.Id == userId, ct);


}
