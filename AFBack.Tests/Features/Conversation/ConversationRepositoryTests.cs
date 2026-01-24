using AFBack.Features.Conversation.DTOs;
using AFBack.Models;
using AFBack.Repository;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace AFBack.Tests.Repository;

public class ConversationRepositoryTests : IDisposable
{
    private readonly ApplicationDbContext _context;
    private readonly ConversationRepository _repository;

    public ConversationRepositoryTests()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;
        
        _context = new ApplicationDbContext(options);
        _repository = new ConversationRepository(_context);
        
        SeedTestData();
    }

    private void SeedTestData()
    {
        var user1 = new User { Id = 1, FullName = "John Doe", Email = "john@test.com" };
        var user2 = new User { Id = 2, FullName = "Jane Smith", Email = "jane@test.com" };
        var user3 = new User { Id = 3, FullName = "Bob Johnson", Email = "bob@test.com" };

        var conversation1 = new Models.Conversation
        {
            Id = 1,
            IsGroup = false,
            LastMessageSentAt = DateTime.UtcNow
        };

        var conversation2 = new Models.Conversation
        {
            Id = 2,
            IsGroup = true,
            GroupName = "Test Group",
            LastMessageSentAt = DateTime.UtcNow.AddHours(-1)
        };

        var conversation3 = new Models.Conversation
        {
            Id = 3,
            IsGroup = false,
            LastMessageSentAt = DateTime.UtcNow.AddHours(-2)
        };

        _context.Users.AddRange(user1, user2, user3);
        _context.Conversations.AddRange(conversation1, conversation2, conversation3);

        // User1 is participant in conversation1 and conversation2
        _context.ConversationParticipants.AddRange(
            new ConversationParticipant
            {
                UserId = 1,
                ConversationId = 1,
                ConversationStatus = ConversationStatus.Accepted,
                HasDeleted = false,
                IsCreator = true
            },
            new ConversationParticipant
            {
                UserId = 2,
                ConversationId = 1,
                ConversationStatus = ConversationStatus.Accepted,
                HasDeleted = false,
                IsCreator = false
            },
            new ConversationParticipant
            {
                UserId = 1,
                ConversationId = 2,
                ConversationStatus = ConversationStatus.Accepted,
                HasDeleted = false,
                IsCreator = false
            },
            new ConversationParticipant
            {
                UserId = 2,
                ConversationId = 2,
                ConversationStatus = ConversationStatus.Pending,
                HasDeleted = false,
                IsCreator = true
            },
            // User1 is NOT in conversation3
            new ConversationParticipant
            {
                UserId = 3,
                ConversationId = 3,
                ConversationStatus = ConversationStatus.Accepted,
                HasDeleted = false,
                IsCreator = true
            }
        );

        _context.SaveChanges();
    }

    [Fact]
    public async Task GetUserConversationDtoById_WithValidUserAndConversation_ReturnsConversation()
    {
        // Arrange
        int userId = 1;
        int conversationId = 1;

        // Act
        var result = await _repository.GetUserConversationDtoById(userId, conversationId);

        // Assert
        Assert.NotNull(result);
        Assert.Equal(conversationId, result.Id);
        Assert.Equal(2, result.Participants.Count);
        Assert.Contains(result.Participants, p => p.User.Id == 1);
        Assert.Contains(result.Participants, p => p.User.Id == 2);
    }

    [Fact]
    public async Task GetUserConversationDtoById_WithGroupConversation_ReturnsGroupDetails()
    {
        // Arrange
        int userId = 1;
        int conversationId = 2;

        // Act
        var result = await _repository.GetUserConversationDtoById(userId, conversationId);

        // Assert
        Assert.NotNull(result);
        Assert.True(result.IsGroup);
        Assert.Equal("Test Group", result.GroupName);
    }

    [Fact]
    public async Task GetUserConversationDtoById_UserNotInConversation_ReturnsNull()
    {
        // Arrange
        int userId = 1;
        int conversationId = 3; // User1 is not in conversation3

        // Act
        var result = await _repository.GetUserConversationDtoById(userId, conversationId);

        // Assert
        Assert.Null(result);
    }

    [Fact]
    public async Task GetUserConversationDtoById_NonExistentConversation_ReturnsNull()
    {
        // Arrange
        int userId = 1;
        int conversationId = 999;

        // Act
        var result = await _repository.GetUserConversationDtoById(userId, conversationId);

        // Assert
        Assert.Null(result);
    }

    [Fact]
    public async Task GetUserConversationDtoById_MasksRejectedStatus_ShowsAsPending()
    {
        // Arrange
        int userId = 1;
        int conversationId = 2;

        // Act
        var result = await _repository.GetUserConversationDtoById(userId, conversationId);

        // Assert
        Assert.NotNull(result);
        var user2Participant = result.Participants.First(p => p.User.Id == 2);
        // User2 has Pending status, should show as Pending
        Assert.Equal(ConversationStatus.Pending, user2Participant.ConversationStatus);
    }

    [Fact]
    public async Task GetUserConversationDtoById_SetsIsCreatorCorrectly()
    {
        // Arrange
        int userId = 1;
        int conversationId = 1;

        // Act
        var result = await _repository.GetUserConversationDtoById(userId, conversationId);

        // Assert
        Assert.NotNull(result);
        var creator = result.Participants.First(p => p.IsCreator);
        Assert.Equal(1, creator.User.Id);
    }

    public void Dispose()
    {
        _context.Database.EnsureDeleted();
        _context.Dispose();
    }
}