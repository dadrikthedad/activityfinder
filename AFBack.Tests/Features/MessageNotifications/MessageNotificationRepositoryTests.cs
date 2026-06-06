using AFBack.Features.MessageNotification.Models.Enum;
using AFBack.Features.MessageNotifications.Models;
using AFBack.Features.MessageNotifications.Repository;
using AFBack.Features.Messaging.Models;
using AFBack.Tests.Builders;
using AFBack.Tests.Common;
using FluentAssertions;
using Conv = AFBack.Features.Conversation.Models.Conversation;

namespace AFBack.Tests.Features.MessageNotifications;

[Collection(nameof(IntegrationTestsCollection))]
public class MessageNotificationRepositoryTests(BackendApplicationFactory factory) : IAsyncLifetime
{
    public Task InitializeAsync() => Task.CompletedTask;

    public async Task DisposeAsync() => await factory.ResetDatabaseAsync();

    // ======================== GetUnreadCountAsync ========================

    [Fact]
    public async Task GetUnreadCountAsync_ShouldOnlyCountUnreadNotifications()
    {
        // Arrange
        var user   = new UserBuilder().AsVerified().Build();
        var sender = new UserBuilder().AsVerified().Build();
        var conv   = new Conv();

        await factory.SeedAsync(async db =>
        {
            db.AppUsers.AddRange(user, sender);
            db.Conversations.Add(conv);
            await db.SaveChangesAsync();

            db.MessageNotifications.AddRange(
                Notification(user.Id, sender.Id, conv.Id, isRead: false),
                Notification(user.Id, sender.Id, conv.Id, isRead: false),
                Notification(user.Id, sender.Id, conv.Id, isRead: true));
            await db.SaveChangesAsync();
        });

        // Act
        var count = await RunQuery(r => r.GetUnreadCountAsync(user.Id));

        // Assert
        count.Should().Be(2);
    }

    // ======================== GetUnreadConversationIdsAsync ========================

    [Fact]
    public async Task GetUnreadConversationIdsAsync_ShouldReturnDistinctConversationIdsWithUnread()
    {
        // Arrange
        var user   = new UserBuilder().AsVerified().Build();
        var sender = new UserBuilder().AsVerified().Build();
        var conv1  = new Conv();
        var conv2  = new Conv();

        await factory.SeedAsync(async db =>
        {
            db.AppUsers.AddRange(user, sender);
            db.Conversations.AddRange(conv1, conv2);
            await db.SaveChangesAsync();

            db.MessageNotifications.AddRange(
                Notification(user.Id, sender.Id, conv1.Id, isRead: false),
                Notification(user.Id, sender.Id, conv1.Id, isRead: false), // duplikat for conv1
                Notification(user.Id, sender.Id, conv2.Id, isRead: false),
                Notification(user.Id, sender.Id, conv2.Id, isRead: true));  // lest — skal ikke telle
            await db.SaveChangesAsync();
        });

        // Act
        var result = await RunQuery(r => r.GetUnreadConversationIdsAsync(user.Id));

        // Assert
        result.Should().HaveCount(2);
        result.Should().Contain(conv1.Id);
        result.Should().Contain(conv2.Id);
    }

    // ======================== GetReactionNotificationAsync ========================

    [Fact]
    public async Task GetReactionNotificationAsync_ShouldReturnUnreadReactionNotificationForMessage()
    {
        // Arrange
        var user   = new UserBuilder().AsVerified().Build();
        var sender = new UserBuilder().AsVerified().Build();
        var conv   = new Conv();
        Message message = null!;

        await factory.SeedAsync(async db =>
        {
            db.AppUsers.AddRange(user, sender);
            db.Conversations.Add(conv);
            await db.SaveChangesAsync();

            message = new Message { ConversationId = conv.Id, KeyInfo = "{}", IV = "iv" };
            db.Messages.Add(message);
            await db.SaveChangesAsync();

            db.MessageNotifications.Add(Notification(user.Id, sender.Id, conv.Id,
                isRead: false,
                type: MessageNotificationType.MessageReaction,
                messageId: message.Id));
            await db.SaveChangesAsync();
        });

        // Act
        var result = await RunQuery(r => r.GetReactionNotificationAsync(user.Id, message.Id));

        // Assert
        result.Should().NotBeNull();
    }

    [Fact]
    public async Task GetReactionNotificationAsync_WhenAlreadyRead_ShouldReturnNull()
    {
        // Arrange
        var user   = new UserBuilder().AsVerified().Build();
        var sender = new UserBuilder().AsVerified().Build();
        var conv   = new Conv();
        Message message = null!;

        await factory.SeedAsync(async db =>
        {
            db.AppUsers.AddRange(user, sender);
            db.Conversations.Add(conv);
            await db.SaveChangesAsync();

            message = new Message { ConversationId = conv.Id, KeyInfo = "{}", IV = "iv" };
            db.Messages.Add(message);
            await db.SaveChangesAsync();

            db.MessageNotifications.Add(Notification(user.Id, sender.Id, conv.Id,
                isRead: true,
                type: MessageNotificationType.MessageReaction,
                messageId: message.Id));
            await db.SaveChangesAsync();
        });

        // Act
        var result = await RunQuery(r => r.GetReactionNotificationAsync(user.Id, message.Id));

        // Assert
        result.Should().BeNull();
    }

    // ======================== GetPaginatedNotificationsAsync ========================

    [Fact]
    public async Task GetPaginatedNotificationsAsync_ShouldReturnCorrectPageAndTotalCount()
    {
        // Arrange
        var user   = new UserBuilder().AsVerified().Build();
        var sender = new UserBuilder().AsVerified().Build();
        var conv   = new Conv();

        await factory.SeedAsync(async db =>
        {
            db.AppUsers.AddRange(user, sender);
            db.Conversations.Add(conv);
            await db.SaveChangesAsync();

            for (var i = 0; i < 5; i++)
                db.MessageNotifications.Add(Notification(user.Id, sender.Id, conv.Id, isRead: false));
            await db.SaveChangesAsync();
        });

        // Act
        var (items, totalCount) = await RunQuery(r =>
            r.GetPaginatedNotificationsAsync(user.Id, page: 1, pageSize: 3));

        // Assert
        items.Should().HaveCount(3);
        totalCount.Should().Be(5);
    }

    // ======================== Hjelpemetoder ========================

    private static MessageNotification Notification(
        string recipientId,
        string senderId,
        int conversationId,
        bool isRead,
        MessageNotificationType type = MessageNotificationType.NewMessage,
        int? messageId = null) =>
        new()
        {
            RecipientId    = recipientId,
            SenderId       = senderId,
            ConversationId = conversationId,
            MessageId      = messageId,
            Type           = type,
            IsRead         = isRead
        };

    private Task<T> RunQuery<T>(Func<MessageNotificationRepository, Task<T>> query) =>
        factory.QueryAsync(async db => await query(new MessageNotificationRepository(db)));
}
