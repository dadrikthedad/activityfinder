using AFBack.DTOs;
using AFBack.Models;
using AFBack.Data;
using AFBack.DTOs.BoostrapDTO;
using Microsoft.EntityFrameworkCore;
using AFBack.Extensions;

namespace AFBack.Services
{
    public class BootstrapService
    {
        private readonly ApplicationDbContext _context;
        private readonly ILogger<BootstrapService> _logger;
        private readonly ConversationService _conversationService;

        public BootstrapService(ApplicationDbContext context, ILogger<BootstrapService> logger, ConversationService conversationService)
        {
            _context = context;
            _logger = logger;
            _conversationService = conversationService;
        }

        public async Task<CriticalBootstrapResponseDTO> GetCriticalBootstrapAsync(int userId)
        {
            try
            {
                // Parallelle kall for bedre performance
                var userTask = GetCurrentUserAsync(userId);
                var conversationsTask = GetRecentConversationsForBootstrapAsync(userId, 10);

                await Task.WhenAll(userTask, conversationsTask);

                var user = await userTask;
                var conversations = await conversationsTask;

                var response = new CriticalBootstrapResponseDTO
                {
                    User = user.ToUserSummaryDTO(),
                    RecentConversations = conversations,
                    SyncToken = GenerateSimpleSyncToken(userId, user.IsOnline)
                };

                return response;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to get critical bootstrap for user {UserId}", userId);
                throw;
            }
        }

        public async Task<SecondaryBootstrapResponseDTO> GetSecondaryBootstrapAsync(int userId)
        {
            try
            {
                // Hent kun brukerinnstillinger
                var settingsTask = GetUserSettingsAsync(userId);
                var friendsTask = GetUserFriendsAsync(userId);
                var blockedUsersTask = GetBlockedUsersAsync(userId);

                await Task.WhenAll(settingsTask, friendsTask, blockedUsersTask);

                var response = new SecondaryBootstrapResponseDTO
                {
                    Settings = (await settingsTask).ToUserSettingsDTO(),
                    Friends = (await friendsTask).ToUserSummaryDTOsSafe(),
                    BlockedUsers = (await blockedUsersTask).ToUserSummaryDTOsSafe()
                };

                return response;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to get secondary bootstrap for user {UserId}", userId);
                throw;
            }
        }
        
        private async Task<User> GetCurrentUserAsync(int userId)
        {
            var user = await _context.Users
                .Include(u => u.Profile)
                .FirstOrDefaultAsync(u => u.Id == userId);

            if (user == null)
            {
                throw new KeyNotFoundException($"User with ID {userId} not found");
            }

            // Oppdater LastSeen når brukeren starter appen
            user.LastSeen = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            return user;
        }
        
        private async Task<List<ConversationDTO>> GetRecentConversationsForBootstrapAsync(int userId, int limit)
        {
            // Bruk din eksisterende ConversationService!
            var conversationResults = await _conversationService.GetUserConversationsSortedAsync(
                userId, 
                includeRejected: false, 
                limit: limit);

            // Konverter til ConversationDTO (limit allerede håndtert i database)
            return conversationResults
                .Select(c => new ConversationDTO
                {
                    Id = c.Conversation.Id,
                    GroupName = c.Conversation.GroupName,
                    IsGroup = c.Conversation.IsGroup,
                    GroupImageUrl = c.Conversation.GroupImageUrl,
                    CreatorId = c.Conversation.CreatorId,
                    IsApproved = c.Conversation.IsApproved,
                    LastMessageSentAt = c.Conversation.LastMessageSentAt,
                    IsPendingApproval = c.IsPendingApproval,
                    Disbanded = c.Conversation.IsDisbanded,
                    DisbandedAt = c.Conversation.DisbandedAt,
                    Participants = c.Conversation.Participants.Select(p => new UserSummaryDTO
                    {
                        Id = p.User.Id,
                        FullName = p.User.FullName,
                        ProfileImageUrl = p.User.Profile?.ProfileImageUrl,
                        GroupRequestStatus = !c.Conversation.IsGroup ? null :
                            p.User.Id == c.Conversation.CreatorId ? GroupRequestStatus.Creator :
                            c.GroupRequestLookup.TryGetValue(p.User.Id, out var status) ? status : 
                            null
                    }).ToList()
                })
                .ToList();
        }

        private async Task<UserSettings?> GetUserSettingsAsync(int userId)
        {
            return await _context.UserSettings
                .FirstOrDefaultAsync(s => s.UserId == userId);
        }
        
        private async Task<List<User>> GetUserFriendsAsync(int userId)
        {
            return await _context.Friends
                .Where(f => f.UserId == userId)
                .Include(f => f.FriendUser)
                .ThenInclude(u => u.Profile)
                .Select(f => f.FriendUser)
                .ToListAsync();
        }

        private async Task<List<User>> GetBlockedUsersAsync(int userId)
        {
            // Hent både brukere du har blokkert OG brukere som har blokkert deg
            var blockedByUser = _context.UserBlock
                .Where(ub => ub.BlockerId == userId)
                .Include(ub => ub.BlockedUser)
                .ThenInclude(u => u.Profile)
                .Select(ub => ub.BlockedUser);

            var blockedUser = _context.UserBlock
                .Where(ub => ub.BlockedUserId == userId)
                .Include(ub => ub.Blocker)
                .ThenInclude(u => u.Profile)
                .Select(ub => ub.Blocker);

            // Kombiner begge lister og fjern duplikater
            var allBlockedUsers = await blockedByUser
                .Union(blockedUser)
                .Distinct()
                .ToListAsync();

            return allBlockedUsers;
        }

        private string GenerateSimpleSyncToken(int userId, bool isOnline)
        {
            var token = new
            {
                userId = userId,
                timestamp = DateTime.UtcNow.ToString("O"),
                version = 1,
                isOnline = isOnline
            };
            
            var json = System.Text.Json.JsonSerializer.Serialize(token);
            return Convert.ToBase64String(System.Text.Encoding.UTF8.GetBytes(json));
        }
    }
}