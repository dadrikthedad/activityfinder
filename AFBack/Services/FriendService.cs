// FriendService.cs
using AFBack.DTOs;
using AFBack.Models;
using AFBack.Data;
using Microsoft.EntityFrameworkCore;

namespace AFBack.Services
{
    public class FriendService
    {
        private readonly ApplicationDbContext _context;
        private readonly ILogger<FriendService> _logger;

        public FriendService(ApplicationDbContext context, ILogger<FriendService> logger)
        {
            _context = context;
            _logger = logger;
        }

        /// <summary>
        /// Hent ventende venneforespørsler for en bruker med paginering
        /// </summary>
        public async Task<(List<FriendInvitationDTO> invitations, int totalCount)> GetPendingFriendInvitationsAsync(
            int userId, 
            int pageNumber = 1, 
            int pageSize = 10)
        {
            try
            {
                _logger.LogDebug("🔍 Getting pending friend invitations for user {UserId} - Page: {Page}, PageSize: {PageSize}", 
                    userId, pageNumber, pageSize);

                if (pageNumber <= 0 || pageSize <= 0)
                {
                    throw new ArgumentException("Page number and size must be greater than zero.");
                }

                var query = _context.FriendInvitations
                    .Where(i => i.ReceiverId == userId && i.Status == InvitationStatus.Pending)
                    .Include(i => i.Sender).ThenInclude(u => u.Profile)
                    .OrderByDescending(i => i.SentAt)
                    .AsNoTracking();

                var totalCount = await query.CountAsync();

                var dbList = await query
                    .Skip((pageNumber - 1) * pageSize)
                    .Take(pageSize)
                    .ToListAsync();

                var dtoList = dbList.Select(ToDto).ToList();

                _logger.LogDebug("✅ Retrieved {InvitationCount} friend invitations out of {TotalCount} total", 
                    dtoList.Count, totalCount);

                return (dtoList, totalCount);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "❌ Failed to get pending friend invitations for user {UserId}", userId);
                throw;
            }
        }

        /// <summary>
        /// Bootstrap wrapper - returnerer kun invitations
        /// </summary>
        public async Task<List<FriendInvitationDTO>> GetPendingFriendInvitationsForBootstrapAsync(
            int userId, 
            int limit = 10)
        {
            var (invitations, _) = await GetPendingFriendInvitationsAsync(userId, pageNumber: 1, pageSize: limit);
            return invitations;
        }

        /// <summary>
        /// Felles DTO-mapping metode
        /// </summary>
        private static FriendInvitationDTO ToDto(FriendInvitation inv) =>
            new()
            {
                Id = inv.Id,
                ReceiverId = inv.ReceiverId,
                Status = inv.Status.ToString().ToLower(), // "pending"/"accepted"/"declined"
                SentAt = inv.SentAt,
                UserSummary = new UserSummaryDTO
                {
                    Id = inv.Sender.Id,
                    FullName = inv.Sender.FullName,
                    ProfileImageUrl = inv.Sender.Profile?.ProfileImageUrl
                }
            };
        
    }
}