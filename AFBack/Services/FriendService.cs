// FriendService.cs
using AFBack.DTOs;
using AFBack.Models;
using AFBack.Data;
using AFBack.Extensions;
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
                _logger.LogDebug(
                    "🔍 Getting pending friend invitations for user {UserId} - Page: {Page}, PageSize: {PageSize}",
                    userId, pageNumber, pageSize);

                if (pageNumber <= 0 || pageSize <= 0)
                {
                    throw new ArgumentException("Page number and size must be greater than zero.");
                }

                var query = _context.FriendInvitations
                    .Where(i => i.ReceiverId == userId && i.Status == InvitationStatus.Pending)
                    .OrderByDescending(i => i.SentAt)
                    .AsNoTracking();

                var totalCount = await query.CountAsync();

                var dbList = await query
                    .Skip((pageNumber - 1) * pageSize)
                    .Take(pageSize)
                    .ToListAsync();

                // 🎯 Bruk nye metoder for å bygge DTO-er med relationship data
                var dtoList = new List<FriendInvitationDTO>();

                foreach (var inv in dbList)
                {
                    var senderSummary = await UserSummaryExtensions.GetUserSummaryWithRelationshipAsync(
                        _context,
                        inv.SenderId,
                        userId // current user's perspective
                    );

                    if (senderSummary != null)
                    {
                        dtoList.Add(inv.ToFriendInvitationDto(senderSummary));
                    }
                }

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

    }
}