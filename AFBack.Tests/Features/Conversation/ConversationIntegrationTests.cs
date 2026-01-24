using System.Net;
using AFBack.Data;
using AFBack.Infrastructure.DTO;
using AFBack.Interface.Repository;
using AFBack.Models;
using Microsoft.EntityFrameworkCore;

namespace AFBack.Tests.Features.Conversation;

public class ConversationIntegrationTests : IDisposable
{
    private readonly ApplicationDbContext _context;
    private readonly ConversationRepository _repository;

    public ConversationIntegrationTests()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;
        _context = new ApplicationDbContext(options);
        _repository = new ConversationRepository(_context);
    }

    [Fact]
    public async Task GetUserConversationsByStatus_OnlyReturnsAcceptedConversations()
    {
        // Arrange
        var user = new User { Id = 1, FullName = "Test User", Email = "test@test.com" };
        await _context.Users.AddAsync(user);

        var conversation1 = new Models.Conversation { Id = 1, IsGroup = false };
        var conversation2 = new Models.Conversation { Id = 2, IsGroup = false };
        await _context.Conversations.AddRangeAsync(conversation1, conversation2);

        var acceptedParticipant = new ConversationParticipant
        {
            UserId = 1,
            ConversationId = 1,
            ConversationStatus = ConversationStatus.Accepted,
            HasDeleted = false
        };

        var pendingParticipant = new ConversationParticipant
        {
            UserId = 1,
            ConversationId = 2,
            ConversationStatus = ConversationStatus.Pending,
            HasDeleted = false
        };

        await _context.ConversationParticipants.AddRangeAsync(acceptedParticipant, pendingParticipant);
        await _context.SaveChangesAsync();

        // Act
        var result = await _repository.GetUserConversationDtoAsyncByStatus(1, 1, 20, ConversationStatus.Accepted);

        // Assert
        Assert.Single(result);
        Assert.Equal(1, result[0].Id);
    }

    [Fact]
    public async Task GetUserConversationsByStatus_OnlyReturnsPendingConversations()
    {
        // Arrange
        var user = new User { Id = 1, FullName = "Test User", Email = "test@test.com" };
        await _context.Users.AddAsync(user);

        var conversation1 = new Models.Conversation { Id = 1, IsGroup = false };
        var conversation2 = new Models.Conversation { Id = 2, IsGroup = false };
        await _context.Conversations.AddRangeAsync(conversation1, conversation2);

        var acceptedParticipant = new ConversationParticipant
        {
            UserId = 1,
            ConversationId = 1,
            ConversationStatus = ConversationStatus.Accepted,
            HasDeleted = false
        };

        var pendingParticipant = new ConversationParticipant
        {
            UserId = 1,
            ConversationId = 2,
            ConversationStatus = ConversationStatus.Pending,
            HasDeleted = false
        };

        await _context.ConversationParticipants.AddRangeAsync(acceptedParticipant, pendingParticipant);
        await _context.SaveChangesAsync();

        // Act
        var result = await _repository.GetUserConversationDtoAsyncByStatus(1, 1, 20, ConversationStatus.Pending);

        // Assert
        Assert.Single(result);
        Assert.Equal(2, result[0].Id);
    }

    [Fact]
    public async Task GetUserConversationsByStatus_OnlyReturnsRejectedConversations()
    {
        // Arrange
        var user = new User { Id = 1, FullName = "Test User", Email = "test@test.com" };
        await _context.Users.AddAsync(user);

        var conversation1 = new Models.Conversation { Id = 1, IsGroup = false };
        var conversation2 = new Models.Conversation { Id = 2, IsGroup = false };
        await _context.Conversations.AddRangeAsync(conversation1, conversation2);

        var acceptedParticipant = new ConversationParticipant
        {
            UserId = 1,
            ConversationId = 1,
            ConversationStatus = ConversationStatus.Accepted,
            HasDeleted = false
        };

        var rejectedParticipant = new ConversationParticipant
        {
            UserId = 1,
            ConversationId = 2,
            ConversationStatus = ConversationStatus.Rejected,
            HasDeleted = false
        };

        await _context.ConversationParticipants.AddRangeAsync(acceptedParticipant, rejectedParticipant);
        await _context.SaveChangesAsync();

        // Act
        var result = await _repository.GetUserConversationDtoAsyncByStatus(1, 1, 20, ConversationStatus.Rejected);

        // Assert
        Assert.Single(result);
        Assert.Equal(2, result[0].Id);
    }

    [Fact]
    public async Task GetUserConversationsByStatus_ExcludesDeletedConversations()
    {
        // Arrange
        var user = new User { Id = 1, FullName = "Test User", Email = "test@test.com" };
        await _context.Users.AddAsync(user);

        var conversation = new Models.Conversation { Id = 1, IsGroup = false };
        await _context.Conversations.AddAsync(conversation);

        var deletedParticipant = new ConversationParticipant
        {
            UserId = 1,
            ConversationId = 1,
            ConversationStatus = ConversationStatus.Accepted,
            HasDeleted = true
        };

        await _context.ConversationParticipants.AddAsync(deletedParticipant);
        await _context.SaveChangesAsync();

        // Act
        var result = await _repository.GetUserConversationDtoAsyncByStatus(1, 1, 20, ConversationStatus.Accepted);

        // Assert
        Assert.Empty(result);
    }

    [Fact]
    public async Task GetUserConversationsByStatus_ReturnsActualParticipantStatus()
    {
        // Arrange
        var user1 = new User { Id = 1, FullName = "User 1", Email = "user1@test.com" };
        var user2 = new User { Id = 2, FullName = "User 2", Email = "user2@test.com" };
        await _context.Users.AddRangeAsync(user1, user2);

        var conversation = new Models.Conversation { Id = 1, IsGroup = false };
        await _context.Conversations.AddAsync(conversation);

        var participant1 = new ConversationParticipant
        {
            UserId = 1,
            ConversationId = 1,
            ConversationStatus = ConversationStatus.Accepted,
            HasDeleted = false
        };

        var participant2 = new ConversationParticipant
        {
            UserId = 2,
            ConversationId = 1,
            ConversationStatus = ConversationStatus.Rejected,
            HasDeleted = false
        };

        await _context.ConversationParticipants.AddRangeAsync(participant1, participant2);
        await _context.SaveChangesAsync();

        // Act
        var result = await _repository.GetUserConversationDtoAsyncByStatus(1, 1, 20, ConversationStatus.Accepted);

        // Assert
        var acceptedParticipant = result[0].Participants.First(p => p.User.Id == 1);
        var rejectedParticipant = result[0].Participants.First(p => p.User.Id == 2);
        
        Assert.Equal(ConversationStatus.Accepted, acceptedParticipant.ConversationStatus);
        Assert.Equal(ConversationStatus.Rejected, rejectedParticipant.ConversationStatus);
    }

    [Fact]
    public async Task GetTotalConversationsByStatus_ReturnsCorrectCount()
    {
        // Arrange
        var user = new User { Id = 1, FullName = "Test User", Email = "test@test.com" };
        await _context.Users.AddAsync(user);

        var conversation1 = new Models.Conversation { Id = 1, IsGroup = false };
        var conversation2 = new Models.Conversation { Id = 2, IsGroup = false };
        var conversation3 = new Models.Conversation { Id = 3, IsGroup = false };
        await _context.Conversations.AddRangeAsync(conversation1, conversation2, conversation3);

        await _context.ConversationParticipants.AddRangeAsync(
            new ConversationParticipant
            {
                UserId = 1,
                ConversationId = 1,
                ConversationStatus = ConversationStatus.Accepted,
                HasDeleted = false
            },
            new ConversationParticipant
            {
                UserId = 1,
                ConversationId = 2,
                ConversationStatus = ConversationStatus.Accepted,
                HasDeleted = false
            },
            new ConversationParticipant
            {
                UserId = 1,
                ConversationId = 3,
                ConversationStatus = ConversationStatus.Pending,
                HasDeleted = false
            }
        );
        await _context.SaveChangesAsync();

        // Act
        var acceptedCount = await _repository.GetTotalConversationsByStatus(1, ConversationStatus.Accepted);
        var pendingCount = await _repository.GetTotalConversationsByStatus(1, ConversationStatus.Pending);

        // Assert
        Assert.Equal(2, acceptedCount);
        Assert.Equal(1, pendingCount);
    }

    [Fact]
    public async Task GetUserConversationsByStatus_PaginationWorks()
    {
        // Arrange
        var user = new User { Id = 1, FullName = "Test User", Email = "test@test.com" };
        await _context.Users.AddAsync(user);

        // Lag 15 samtaler
        for (int i = 1; i <= 15; i++)
        {
            var conversation = new Models.Conversation 
            { 
                Id = i, 
                IsGroup = false,
                LastMessageSentAt = DateTime.UtcNow.AddMinutes(-i) // For konsistent sortering
            };
            await _context.Conversations.AddAsync(conversation);

            var participant = new ConversationParticipant
            {
                UserId = 1,
                ConversationId = i,
                ConversationStatus = ConversationStatus.Accepted,
                HasDeleted = false
            };
            await _context.ConversationParticipants.AddAsync(participant);
        }
        await _context.SaveChangesAsync();

        // Act
        var page1 = await _repository.GetUserConversationDtoAsyncByStatus(1, 1, 10, ConversationStatus.Accepted);
        var page2 = await _repository.GetUserConversationDtoAsyncByStatus(1, 2, 10, ConversationStatus.Accepted);

        // Assert
        Assert.Equal(10, page1.Count);
        Assert.Equal(5, page2.Count);
        
        // Sjekk at ingen duplikater
        var allIds = page1.Select(c => c.Id).Concat(page2.Select(c => c.Id)).ToList();
        Assert.Equal(15, allIds.Distinct().Count());
    }

    public void Dispose()
    {
        _context.Database.EnsureDeleted();
        _context.Dispose();
    }
    
    [Fact]
    public async Task GetConversationById_WithValidId_ReturnsOk()
    {
        // Arrange
        int conversationId = 1; // Assumes test data is seeded

        // Act
        var response = await _client.GetAsync($"/api/conversation/{conversationId}");

        // Assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        
        var result = await response.Content.ReadFromJsonAsync<ApiResponse<ConversationDto>>();
        Assert.NotNull(result);
        Assert.True(result.Success);
        Assert.Equal(conversationId, result.Data.Id);
    }

    [Fact]
    public async Task GetConversationById_WithInvalidId_ReturnsBadRequest()
    {
        // Arrange
        int invalidId = 0;

        // Act
        var response = await _client.GetAsync($"/api/conversation/{invalidId}");

        // Assert
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task GetConversationById_NotParticipant_ReturnsNotFound()
    {
        // Arrange
        int conversationId = 999; // Conversation user is not part of

        // Act
        var response = await _client.GetAsync($"/api/conversation/{conversationId}");

        // Assert
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task GetConversationById_Unauthorized_ReturnsUnauthorized()
    {
        // Arrange
        var clientWithoutAuth = new HttpClient();
        int conversationId = 1;

        // Act
        var response = await clientWithoutAuth.GetAsync($"/api/conversation/{conversationId}");

        // Assert
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

}