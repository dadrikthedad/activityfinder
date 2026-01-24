using AFBack.Constants;
using AFBack.Data;
using AFBack.DTOs;
using AFBack.Features.MessageBroadcast.DTO.cs;
using AFBack.Features.MessageBroadcast.Service;
using AFBack.Hubs;
using AFBack.Infrastructure.Services;
using AFBack.Interface.Repository;
using AFBack.Interface.Services;
using AFBack.Models;
using AFBack.Services;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace AFBack.Tests.Features.MessageBroadcast;

public class MessageBroadcastServiceTests
{
    private readonly Mock<ILogger<MessageBroadcastService>> _mockLogger;
    private readonly Mock<IConversationRepository> _mockConversationRepo;
    private readonly Mock<IMessageRepository> _mockMessageRepo;
    private readonly Mock<IHubContext<UserHub>> _mockHubContext;
    private readonly Mock<IUserRepository> _mockUserRepo;
    private readonly Mock<ISyncService> _mockSyncService;
    private readonly Mock<IMessageNotificationService> _mockNotificationService;
    private readonly Mock<IBackgroundTaskQueue> _mockTaskQueue;
    private readonly Mock<IServiceScopeFactory> _mockScopeFactory;
    private readonly ApplicationDbContext _context;
    private readonly MessageBroadcastService _service;

    public MessageBroadcastServiceTests()
    {
        // Setup in-memory database
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;
        _context = new ApplicationDbContext(options);

        // Setup mocks
        _mockLogger = new Mock<ILogger<MessageBroadcastService>>();
        _mockConversationRepo = new Mock<IConversationRepository>();
        _mockMessageRepo = new Mock<IMessageRepository>();
        _mockHubContext = new Mock<IHubContext<UserHub>>();
        _mockUserRepo = new Mock<IUserRepository>();
        _mockSyncService = new Mock<ISyncService>();
        _mockNotificationService = new Mock<IMessageNotificationService>();
        _mockTaskQueue = new Mock<IBackgroundTaskQueue>();
        _mockScopeFactory = new Mock<IServiceScopeFactory>();

        // Create service
        _service = new MessageBroadcastService(
            _context,
            _mockLogger.Object,
            _mockConversationRepo.Object,
            _mockMessageRepo.Object,
            _mockHubContext.Object,
            _mockUserRepo.Object,
            _mockSyncService.Object,
            _mockNotificationService.Object,
            _mockTaskQueue.Object,
            _mockScopeFactory.Object
        );
    }

    [Fact]
    public void QueueNewMessageBackgroundTasks_QueuesTask()
    {
        // Arrange
        int messageId = 1;
        int conversationId = 1;
        int userId = 1;
        var sentAt = DateTime.UtcNow;

        // Act
        _service.QueueNewMessageBackgroundTasks(messageId, conversationId, userId, sentAt);

        // Assert
        _mockTaskQueue.Verify(q => q.QueueAsync(It.IsAny<Func<Task>>()), Times.Once);
    }

    [Fact]
    public async Task ProcessMessageBroadcast_WithValidData_BroadcastsToAllParticipants()
    {
        // Arrange
        int messageId = 1;
        int conversationId = 1;
        int senderId = 1;
        var sentAt = DateTime.UtcNow;

        var conversation = new Conversation
        {
            Id = conversationId,
            IsGroup = true,
            Participants = new List<ConversationParticipant>
            {
                new() { UserId = senderId, ConversationStatus = ConversationStatus.Creator },
                new() { UserId = 2, ConversationStatus = ConversationStatus.Approved },
                new() { UserId = 3, ConversationStatus = ConversationStatus.Pending },
                new() { UserId = 4, ConversationStatus = ConversationStatus.Rejected }
            }
        };

        var response = new EncryptedMessageBroadcastResponse
        {
            Id = messageId,
            SenderId = senderId,
            Sender = new UserSummaryDTO { Id = senderId, FullName = "Sender", ProfileImageUrl = null },
            ConversationId = conversationId,
            SentAt = sentAt
        };

        var users = new Dictionary<int, (string FullName, string? ProfileImageUrl)>
        {
            { senderId, ("Sender", null) },
            { 2, ("User 2", null) },
            { 3, ("User 3", null) }
        };

        _mockConversationRepo.Setup(r => r.GetConversation(conversationId))
            .ReturnsAsync(conversation);
        _mockMessageRepo.Setup(r => r.GetAndMapMessageEncryptedMessage(messageId))
            .ReturnsAsync(response);
        _mockUserRepo.Setup(r => r.GetUserSummaries(It.IsAny<IEnumerable<int>>()))
            .ReturnsAsync(users);

        var mockClients = new Mock<IHubClients>();
        var mockClientProxy = new Mock<IClientProxy>();
        _mockHubContext.Setup(h => h.Clients).Returns(mockClients.Object);
        mockClients.Setup(c => c.User(It.IsAny<string>())).Returns(mockClientProxy.Object);

        // Act
        await _service.ProcessMessageBroadcast(messageId, conversationId, senderId, sentAt);

        // Assert
        // SignalR sent to 2 users (approved + pending, not sender or rejected)
        mockClientProxy.Verify(
            c => c.SendCoreAsync("IncomingMessage", It.IsAny<object[]>(), default),
            Times.Exactly(2)
        );

        // Notification sent to 1 user (only approved, not pending or sender)
        _mockNotificationService.Verify(
            n => n.CreateMessageNotificationAsync(2, senderId, conversationId, messageId),
            Times.Once
        );

        // Sync event sent to 3 users (all except rejected)
        _mockSyncService.Verify(
            s => s.CreateAndDistributeSyncEventAsync(
                SyncEventTypes.NEW_MESSAGE,
                It.IsAny<object>(),
                It.Is<IEnumerable<int>>(ids => ids.Count() == 3),
                null,
                "API",
                messageId,
                "Message"
            ),
            Times.Once
        );

        // Conversation updated
        Assert.Equal(sentAt, conversation.LastMessageSentAt);
    }

    [Fact]
    public async Task BroadcastSignalRAsync_SendsToAllExceptSender()
    {
        // Arrange
        var participantsWithStatus = new Dictionary<int, ConversationStatus?>
        {
            { 1, ConversationStatus.Creator },
            { 2, ConversationStatus.Approved },
            { 3, ConversationStatus.Pending }
        };

        var response = new EncryptedMessageBroadcastResponse
        {
            Id = 1,
            SenderId = 1,
            Sender = new UserSummaryDTO { Id = 1, FullName = "Sender", ProfileImageUrl = null }
        };

        var mockClients = new Mock<IHubClients>();
        var mockClientProxy = new Mock<IClientProxy>();
        _mockHubContext.Setup(h => h.Clients).Returns(mockClients.Object);
        mockClients.Setup(c => c.User(It.IsAny<string>())).Returns(mockClientProxy.Object);

        // Act
        await _service.BroadcastSignalRAsync(participantsWithStatus, response, 1);

        // Assert - should send to user 2 and 3, not to sender (1)
        mockClientProxy.Verify(
            c => c.SendCoreAsync("IncomingMessage", It.IsAny<object[]>(), default),
            Times.Exactly(2)
        );
    }

    [Fact]
    public async Task BroadcastSignalRAsync_SetsSilentForPendingUsers()
    {
        // Arrange
        var participantsWithStatus = new Dictionary<int, ConversationStatus?>
        {
            { 1, ConversationStatus.Creator },
            { 2, ConversationStatus.Pending }
        };

        var response = new EncryptedMessageBroadcastResponse
        {
            Id = 1,
            SenderId = 1,
            Sender = new UserSummaryDTO { Id = 1, FullName = "Sender", ProfileImageUrl = null }
        };

        object? capturedMessage = null;
        var mockClients = new Mock<IHubClients>();
        var mockClientProxy = new Mock<IClientProxy>();
        
        mockClientProxy.Setup(c => c.SendCoreAsync("IncomingMessage", It.IsAny<object[]>(), default))
            .Callback<string, object[], CancellationToken>((method, args, token) =>
            {
                capturedMessage = args[0];
            })
            .Returns(Task.CompletedTask);

        _mockHubContext.Setup(h => h.Clients).Returns(mockClients.Object);
        mockClients.Setup(c => c.User("2")).Returns(mockClientProxy.Object);

        // Act
        await _service.BroadcastSignalRAsync(participantsWithStatus, response, 1);

        // Assert
        Assert.NotNull(capturedMessage);
        var messageResponse = capturedMessage as EncryptedMessageBroadcastResponse;
        Assert.NotNull(messageResponse);
        Assert.True(messageResponse.IsSilent); // Pending user should get silent message
    }

    [Fact]
    public async Task BroadcastMessageNotificationsAsync_OnlySendsToApprovedUsers()
    {
        // Arrange
        var participantsWithStatus = new Dictionary<int, ConversationStatus?>
        {
            { 1, ConversationStatus.Creator }, // Sender - should not receive
            { 2, ConversationStatus.Approved }, // Should receive
            { 3, ConversationStatus.Pending }   // Should not receive
        };

        var response = new EncryptedMessageBroadcastResponse { Id = 1 };

        // Act
        await _service.BroadcastMessageNotificationsAsync(participantsWithStatus, response, 1, 1);

        // Assert - only user 2 should receive notification
        _mockNotificationService.Verify(
            n => n.CreateMessageNotificationAsync(2, 1, 1, 1),
            Times.Once
        );
        _mockNotificationService.Verify(
            n => n.CreateMessageNotificationAsync(It.IsAny<int>(), It.IsAny<int>(), It.IsAny<int>(), It.IsAny<int>()),
            Times.Once
        );
    }

    [Fact]
    public async Task BroadcastSyncEventsAsync_SendsToAllParticipants()
    {
        // Arrange
        var participantsWithStatus = new Dictionary<int, ConversationStatus?>
        {
            { 1, ConversationStatus.Creator },
            { 2, ConversationStatus.Approved },
            { 3, ConversationStatus.Pending }
        };

        var conversation = new Conversation
        {
            Id = 1,
            IsGroup = true,
            GroupName = "Test Group"
        };

        var response = new EncryptedMessageBroadcastResponse { Id = 1 };

        var users = new Dictionary<int, (string FullName, string? ProfileImageUrl)>
        {
            { 1, ("User 1", null) },
            { 2, ("User 2", null) },
            { 3, ("User 3", null) }
        };

        _mockUserRepo.Setup(r => r.GetUserSummaries(It.IsAny<IEnumerable<int>>()))
            .ReturnsAsync(users);

        // Act
        await _service.BroadcastSyncEventsAsync(participantsWithStatus, response, conversation);

        // Assert - should send to all 3 users
        _mockSyncService.Verify(
            s => s.CreateAndDistributeSyncEventAsync(
                SyncEventTypes.NEW_MESSAGE,
                It.IsAny<object>(),
                It.Is<IEnumerable<int>>(ids => ids.Count() == 3),
                null,
                "API",
                1,
                "Message"
            ),
            Times.Once
        );
    }
    
    [Fact]
    public async Task ProcessMessageBroadcast_WhenConversationNotFound_HandlesGracefully()
    {
        // Arrange
        _mockConversationRepo.Setup(r => r.GetConversation(It.IsAny<int>()))
            .ReturnsAsync((Conversation?)null);

        // Act & Assert
        await Assert.ThrowsAsync<NullReferenceException>(() => 
            _service.ProcessMessageBroadcast(1, 1, 1, DateTime.UtcNow));
    }

    [Fact]
    public async Task ProcessMessageBroadcast_WhenMessageNotFound_HandlesGracefully()
    {
        // Arrange
        var conversation = new Conversation { Id = 1, Participants = new List<ConversationParticipant>() };
        _mockConversationRepo.Setup(r => r.GetConversation(1)).ReturnsAsync(conversation);
        _mockMessageRepo.Setup(r => r.GetAndMapMessageEncryptedMessage(It.IsAny<int>()))
            .ReturnsAsync((EncryptedMessageBroadcastResponse?)null);

        // Act & Assert
        await Assert.ThrowsAsync<NullReferenceException>(() => 
            _service.ProcessMessageBroadcast(1, 1, 1, DateTime.UtcNow));
    }
    
    [Fact]
    public async Task ProcessMessageBroadcast_WithOnlyRejectedParticipants_DoesNotSendAnything()
    {
        // Arrange
        var conversation = new Conversation
        {
            Id = 1,
            Participants = new List<ConversationParticipant>
            {
                new() { UserId = 1, ConversationStatus = ConversationStatus.Creator },
                new() { UserId = 2, ConversationStatus = ConversationStatus.Rejected }
            }
        };

        var response = new EncryptedMessageBroadcastResponse
        {
            Id = 1,
            SenderId = 1,
            Sender = new UserSummaryDTO { Id = 1, FullName = "Sender", ProfileImageUrl = null }
        };

        _mockConversationRepo.Setup(r => r.GetConversation(1)).ReturnsAsync(conversation);
        _mockMessageRepo.Setup(r => r.GetAndMapMessageEncryptedMessage(1)).ReturnsAsync(response);

        var mockClients = new Mock<IHubClients>();
        var mockClientProxy = new Mock<IClientProxy>();
        _mockHubContext.Setup(h => h.Clients).Returns(mockClients.Object);

        var users = new Dictionary<int, (string FullName, string? ProfileImageUrl)>
        {
            { 1, ("Sender", null) }
        };
        _mockUserRepo.Setup(r => r.GetUserSummaries(It.IsAny<IEnumerable<int>>())).ReturnsAsync(users);

        // Act
        await _service.ProcessMessageBroadcast(1, 1, 1, DateTime.UtcNow);

        // Assert - no SignalR sent (only sender, and sender doesn't get SignalR)
        mockClientProxy.Verify(
            c => c.SendCoreAsync(It.IsAny<string>(), It.IsAny<object[]>(), default),
            Times.Never
        );
    }

    [Fact]
    public async Task ProcessMessageBroadcast_WithEmptyParticipants_CompletesSuccessfully()
    {
        // Arrange
        var conversation = new Conversation
        {
            Id = 1,
            Participants = new List<ConversationParticipant>()
        };

        var response = new EncryptedMessageBroadcastResponse { Id = 1, SenderId = 1 };

        _mockConversationRepo.Setup(r => r.GetConversation(1)).ReturnsAsync(conversation);
        _mockMessageRepo.Setup(r => r.GetAndMapMessageEncryptedMessage(1)).ReturnsAsync(response);

        var users = new Dictionary<int, (string FullName, string? ProfileImageUrl)>();
        _mockUserRepo.Setup(r => r.GetUserSummaries(It.IsAny<IEnumerable<int>>())).ReturnsAsync(users);

        // Act & Assert - should not throw
        await _service.ProcessMessageBroadcast(1, 1, 1, DateTime.UtcNow);
    }
    
    [Fact]
    public async Task BroadcastSignalRAsync_WhenSignalRFails_ContinuesWithOtherUsers()
    {
        // Arrange
        var participantsWithStatus = new Dictionary<int, ConversationStatus?>
        {
            { 1, ConversationStatus.Creator },
            { 2, ConversationStatus.Approved },
            { 3, ConversationStatus.Approved }
        };

        var response = new EncryptedMessageBroadcastResponse
        {
            Id = 1,
            SenderId = 1,
            Sender = new UserSummaryDTO { Id = 1, FullName = "Sender", ProfileImageUrl = null }
        };

        var mockClients = new Mock<IHubClients>();
        var failingProxy = new Mock<IClientProxy>();
        var successProxy = new Mock<IClientProxy>();

        failingProxy.Setup(c => c.SendCoreAsync(It.IsAny<string>(), It.IsAny<object[]>(), default))
            .ThrowsAsync(new Exception("SignalR failed"));
    
        successProxy.Setup(c => c.SendCoreAsync(It.IsAny<string>(), It.IsAny<object[]>(), default))
            .Returns(Task.CompletedTask);

        _mockHubContext.Setup(h => h.Clients).Returns(mockClients.Object);
        mockClients.Setup(c => c.User("2")).Returns(failingProxy.Object);
        mockClients.Setup(c => c.User("3")).Returns(successProxy.Object);

        // Act - should not throw
        await _service.BroadcastSignalRAsync(participantsWithStatus, response, 1);

        // Assert - warning logged for failed user
        _mockLogger.Verify(
            x => x.Log(
                LogLevel.Warning,
                It.IsAny<EventId>(),
                It.Is<It.IsAnyType>((o, t) => o.ToString()!.Contains("Failed to send message to user")),
                It.IsAny<Exception>(),
                It.IsAny<Func<It.IsAnyType, Exception?, string>>()),
            Times.Once);
    }
    
    [Fact]
    public async Task ProcessMessageBroadcast_CompleteFlow_UpdatesConversation()
    {
        // Arrange
        var sentAt = DateTime.UtcNow;
        var conversation = new Conversation
        {
            Id = 1,
            IsGroup = false,
            LastMessageSentAt = null,
            Participants = new List<ConversationParticipant>
            {
                new() { UserId = 1, ConversationStatus = ConversationStatus.Creator },
                new() { UserId = 2, ConversationStatus = ConversationStatus.Approved }
            }
        };

        _context.Conversations.Add(conversation);
        await _context.SaveChangesAsync();

        var response = new EncryptedMessageBroadcastResponse
        {
            Id = 1,
            SenderId = 1,
            Sender = new UserSummaryDTO { Id = 1, FullName = "Sender", ProfileImageUrl = null }
        };

        _mockConversationRepo.Setup(r => r.GetConversation(1)).ReturnsAsync(conversation);
        _mockMessageRepo.Setup(r => r.GetAndMapMessageEncryptedMessage(1)).ReturnsAsync(response);
    
        var users = new Dictionary<int, (string FullName, string? ProfileImageUrl)>
        {
            { 1, ("User 1", null) },
            { 2, ("User 2", null) }
        };
        _mockUserRepo.Setup(r => r.GetUserSummaries(It.IsAny<IEnumerable<int>>())).ReturnsAsync(users);

        var mockClients = new Mock<IHubClients>();
        var mockClientProxy = new Mock<IClientProxy>();
        _mockHubContext.Setup(h => h.Clients).Returns(mockClients.Object);
        mockClients.Setup(c => c.User(It.IsAny<string>())).Returns(mockClientProxy.Object);

        // Act
        await _service.ProcessMessageBroadcast(1, 1, 1, sentAt);

        // Assert - conversation was updated in database
        var updatedConversation = await _context.Conversations.FindAsync(1);
        Assert.NotNull(updatedConversation);
        Assert.Equal(sentAt, updatedConversation.LastMessageSentAt);
    }
}