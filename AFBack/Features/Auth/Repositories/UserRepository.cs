using AFBack.Common.DTOs;
using AFBack.Data;
using AFBack.DTOs;
using AFBack.Features.Auth.Models;
using Microsoft.EntityFrameworkCore;

namespace AFBack.Features.Auth.Repositories;

public class UserRepository(AppDbContext context) : IUserRepository
{   
    
    // ======================== GET-operasjoner ========================
    /// <inheritdoc />
    public async Task<AppUser?> FindByPhoneAsync(string phoneNumber) => await context.Users
            .FirstOrDefaultAsync(u => u.PhoneNumber == phoneNumber);
    
    /// <inheritdoc />
    public async Task<bool> UserExistsAsync(string userId) =>
        await context.AppUsers.AnyAsync(u => u.Id == userId);
    
    
    // ======================== User Summary ========================
    
    /// <inheritdoc />
    public async Task<UserSummaryDto?> GetUserSummaryAsync(string userId) =>
        await context.AppUsers
            .AsNoTracking()
            .Where(u => u.Id == userId)
            .Select(u => new UserSummaryDto
            {
                Id = userId,
                FullName = u.FullName,
                ProfileImageUrl = u.ProfileImageUrl
            })
            .FirstOrDefaultAsync();
            
    
    /// <inheritdoc />
    public async Task<Dictionary<string, UserSummaryDto>> GetUserSummariesAsync(List<string> userIds)
        => await context.AppUsers
                .AsNoTracking()
                .Where(u => userIds.Contains(u.Id))
                .Select(u => new UserSummaryDto
                {
                    Id = u.Id,
                    FullName = u.FullName,
                    ProfileImageUrl = u.ProfileImageUrl
                })
                .ToDictionaryAsync(u => u.Id);
    
    /// <inheritdoc />
    public async Task<List<AppUser>> GetUnverifiedUsersAsync(
        DateTime nothingVerifiedCutoff, 
        DateTime partiallyVerifiedCutoff, 
        CancellationToken cancellationToken = default) 
        => await context.Users
            .Where(u => 
                (!u.EmailConfirmed && !u.PhoneNumberConfirmed && u.CreatedAt < nothingVerifiedCutoff)
                || (u.EmailConfirmed && !u.PhoneNumberConfirmed && u.CreatedAt < partiallyVerifiedCutoff))
            .ToListAsync(cancellationToken);
    
    
}
