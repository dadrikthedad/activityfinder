// Service metode for å hente godkjente brukere ved oppstart

using AFBack.Controllers;
using AFBack.Data;
using AFBack.DTOs;
using AFBack.Hubs;
using AFBack.Models;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace AFBack.Services;

public class InitializerService
{
    private readonly ApplicationDbContext _context;
    private readonly IHubContext<UserHub> _hubContext;
    private readonly MessageNotificationService _messageNotificationService;
    private readonly SendMessageCache _msgCache;
    private readonly IBackgroundTaskQueue _taskQueue;
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<UserController> _logger;

    public InitializerService(ApplicationDbContext context, IHubContext<UserHub> hubContext,
        MessageNotificationService messageNotificationService, SendMessageCache msgCache,
        IBackgroundTaskQueue taskQueue, IServiceScopeFactory scopeFactory, ILogger<UserController> logger)
    {
        _context = context;
        _hubContext = hubContext;
        _messageNotificationService = messageNotificationService;
        _msgCache = msgCache;
        _taskQueue = taskQueue;
        _scopeFactory = scopeFactory;
        _logger = logger;

    }

    public async Task<List<ApprovedUserDto>> GetApprovedUsersForUserAsync(int userId)
    {
        // Hent alle samtaler brukeren er medlem av, sammen med godkjente sendere
        var userConversations = await _context.ConversationParticipants
            .AsNoTracking()
            .Where(cp => cp.UserId == userId)
            .Select(cp => cp.ConversationId)
            .ToListAsync();

        // Hent alle brukere som kan sende til disse samtalene (unntatt brukeren selv)
        var approvedUsers = await _context.CanSend
            .AsNoTracking()
            .Include(cs => cs.User)
            .ThenInclude(u => u.Profile)
            .Include(cs => cs.Conversation)
            .Where(cs => userConversations.Contains(cs.ConversationId) && cs.UserId != userId)
            .Select(cs => new ApprovedUserDto
            {
                UserId = cs.UserId,
                FullName = cs.User.FullName,
                ProfileImageUrl = cs.User.Profile != null ? cs.User.Profile.ProfileImageUrl : null,
                ConversationId = cs.ConversationId,
                ConversationName = cs.Conversation.IsGroup ? cs.Conversation.GroupName : null,
                IsGroup = cs.Conversation.IsGroup,
                ApprovedAt = cs.ApprovedAt,
                Reason = cs.Reason
            })
            .OrderBy(au => au.FullName)
            .ToListAsync();

        return approvedUsers;
    }

// Alternativ: Hent per samtale
    public async Task<Dictionary<int, List<ApprovedUserDto>>> GetApprovedUsersByConversationAsync(int userId)
    {
        var userConversations = await _context.ConversationParticipants
            .AsNoTracking()
            .Where(cp => cp.UserId == userId)
            .Select(cp => cp.ConversationId)
            .ToListAsync();

        var approvedUsers = await _context.CanSend
            .AsNoTracking()
            .Include(cs => cs.User)
            .ThenInclude(u => u.Profile)
            .Where(cs => userConversations.Contains(cs.ConversationId) && cs.UserId != userId)
            .GroupBy(cs => cs.ConversationId)
            .ToDictionaryAsync(
                g => g.Key,
                g => g.Select(cs => new ApprovedUserDto
                {
                    UserId = cs.UserId,
                    FullName = cs.User.FullName,
                    ProfileImageUrl = cs.User.Profile != null ? cs.User.Profile.ProfileImageUrl : null,
                    ConversationId = cs.ConversationId,
                    ApprovedAt = cs.ApprovedAt,
                    Reason = cs.Reason
                }).ToList()
            );

        return approvedUsers;
    }

// Enkelt bruk med navigation properties
    public async Task<List<UserSummaryDTO>> GetApprovedUsersSimpleAsync(int conversationId)
    {
        var conversation = await _context.Conversations
            .AsNoTracking()
            .Include(c => c.ApprovedSenders)
            .ThenInclude(cs => cs.User)
            .ThenInclude(u => u.Profile)
            .FirstOrDefaultAsync(c => c.Id == conversationId);

        if (conversation == null)
            return new List<UserSummaryDTO>();

        return conversation.ApprovedSenders
            .Select(cs => new UserSummaryDTO
            {
                Id = cs.User.Id,
                FullName = cs.User.FullName,
                ProfileImageUrl = cs.User.Profile?.ProfileImageUrl
            })
            .ToList();
    }

// DTO for respons
    public class ApprovedUserDto
    {
        public int UserId { get; set; }
        public string FullName { get; set; } = string.Empty;
        public string? ProfileImageUrl { get; set; }
        public int ConversationId { get; set; }
        public string? ConversationName { get; set; }
        public bool IsGroup { get; set; }
        public DateTime ApprovedAt { get; set; }
        public CanSendReason Reason { get; set; }
    }
}