using AFBack.Features.Conversation.Enums;
using AFBack.Features.Conversation.Models;
using AFBack.Features.Messaging.Models;
using Conv = AFBack.Features.Conversation.Models.Conversation;
using AFBack.Features.Messaging.Repository;
using AFBack.Tests.Builders;
using AFBack.Tests.Common;
using FluentAssertions;

namespace AFBack.Tests.Features.Messaging;

[Collection(nameof(IntegrationTestsCollection))]
public class MessageRepositoryTests(BackendApplicationFactory factory) : IAsyncLifetime
{
    public Task InitializeAsync() => Task.CompletedTask;

    public async Task DisposeAsync() => await factory.ResetDatabaseAsync();

    // ======================== MessageExistsInConversationAsync ========================

    [Fact]
    public async Task MessageExistsInConversationAsync_WhenMessageIsDeleted_ShouldReturnFalse()
    {
        // Arrange
        var (conv, message) = await SeedConversationWithMessage(isDeleted: true);

        // Act
        var exists = await RunQuery(r => r.MessageExistsInConversationAsync(message.Id, conv.Id));

        // Assert
        exists.Should().BeFalse();
    }

    [Fact]
    public async Task MessageExistsInConversationAsync_WhenMessageExistsAndNotDeleted_ShouldReturnTrue()
    {
        // Arrange
        var (conv, message) = await SeedConversationWithMessage(isDeleted: false);

        // Act
        var exists = await RunQuery(r => r.MessageExistsInConversationAsync(message.Id, conv.Id));

        // Assert
        exists.Should().BeTrue();
    }

    [Fact]
    public async Task MessageExistsInConversationAsync_WhenMessageBelongsToOtherConversation_ShouldReturnFalse()
    {
        // Arrange
        var conv1 = new Conv();
        var conv2 = new Conv();
        Message message = null!;

        await factory.SeedAsync(async db =>
        {
            db.Conversations.AddRange(conv1, conv2);
            await db.SaveChangesAsync();

            message = BuildMessage(conv1.Id);
            db.Messages.Add(message);
            await db.SaveChangesAsync();
        });

        // Act
        var exists = await RunQuery(r => r.MessageExistsInConversationAsync(message.Id, conv2.Id));

        // Assert
        exists.Should().BeFalse();
    }

    // ======================== GetMessagesByConversationIdAsync ========================

    [Fact]
    public async Task GetMessagesByConversationIdAsync_ShouldReturnNewestFirst()
    {
        // Arrange
        var conv = new Conv();
        await factory.SeedAsync(async db =>
        {
            db.Conversations.Add(conv);
            await db.SaveChangesAsync();

            var older = BuildMessage(conv.Id, sentAt: DateTime.UtcNow.AddMinutes(-10));
            var newer = BuildMessage(conv.Id, sentAt: DateTime.UtcNow);
            db.Messages.AddRange(older, newer);
            await db.SaveChangesAsync();
        });

        // Act
        var results = await RunQuery(r => r.GetMessagesByConversationIdAsync(conv.Id, page: 1, pageSize: 10));

        // Assert
        results.Should().HaveCount(2);
        results[0].SentAt.Should().BeAfter(results[1].SentAt);
    }

    [Fact]
    public async Task GetMessagesByConversationIdAsync_WhenPage2_ShouldSkipFirstPage()
    {
        // Arrange
        var conv = new Conv();
        var messageIds = new List<int>();

        await factory.SeedAsync(async db =>
        {
            db.Conversations.Add(conv);
            await db.SaveChangesAsync();

            for (var i = 0; i < 3; i++)
            {
                var msg = BuildMessage(conv.Id, sentAt: DateTime.UtcNow.AddMinutes(-i));
                db.Messages.Add(msg);
            }
            await db.SaveChangesAsync();
        });

        var page1 = await RunQuery(r => r.GetMessagesByConversationIdAsync(conv.Id, page: 1, pageSize: 2));

        // Act
        var page2 = await RunQuery(r => r.GetMessagesByConversationIdAsync(conv.Id, page: 2, pageSize: 2));

        // Assert
        page2.Should().HaveCount(1);
        page2.Should().NotContain(m => page1.Any(p => p.Id == m.Id));
    }

    // ======================== GetMessagesWithValidationAsync ========================

    [Fact]
    public async Task GetMessagesWithValidationAsync_WhenConversationDoesNotExist_ShouldReturnConversationExistsFalse()
    {
        // Act
        var result = await RunQuery(r =>
            r.GetMessagesWithValidationAsync("user-id", conversationId: 9999, page: 1, pageSize: 10));

        // Assert
        result.ConversationExists.Should().BeFalse();
        result.Messages.Should().BeEmpty();
        result.TotalCount.Should().Be(0);
    }

    [Fact]
    public async Task GetMessagesWithValidationAsync_WhenUserIsNotParticipant_ShouldReturnNullParticipantStatus()
    {
        // Arrange
        var conv = new Conv();
        await factory.SeedAsync(async db =>
        {
            db.Conversations.Add(conv);
            await db.SaveChangesAsync();
        });

        // Act
        var result = await RunQuery(r =>
            r.GetMessagesWithValidationAsync("ukjent-bruker", conv.Id, page: 1, pageSize: 10));

        // Assert
        result.ConversationExists.Should().BeTrue();
        result.ParticipantStatus.Should().BeNull();
    }

    [Fact]
    public async Task GetMessagesWithValidationAsync_WhenUserIsAcceptedParticipant_ShouldReturnCorrectStatus()
    {
        // Arrange
        var user = new UserBuilder().AsVerified().Build();
        var conv = new Conv();

        await factory.SeedAsync(async db =>
        {
            db.AppUsers.Add(user);
            db.Conversations.Add(conv);
            await db.SaveChangesAsync();

            db.ConversationParticipants.Add(new ConversationParticipant
            {
                UserId = user.Id,
                ConversationId = conv.Id,
                Status = ConversationStatus.Accepted
            });
            await db.SaveChangesAsync();
        });

        // Act
        var result = await RunQuery(r =>
            r.GetMessagesWithValidationAsync(user.Id, conv.Id, page: 1, pageSize: 10));

        // Assert
        result.ParticipantStatus.Should().Be(ConversationStatus.Accepted);
    }

    [Fact]
    public async Task GetMessagesWithValidationAsync_ShouldExcludeDeletedMessagesFromResultsAndCount()
    {
        // Arrange
        var user = new UserBuilder().AsVerified().Build();
        var conv = new Conv();

        await factory.SeedAsync(async db =>
        {
            db.AppUsers.Add(user);
            db.Conversations.Add(conv);
            await db.SaveChangesAsync();

            db.ConversationParticipants.Add(new ConversationParticipant
            {
                UserId = user.Id,
                ConversationId = conv.Id,
                Status = ConversationStatus.Accepted
            });

            db.Messages.Add(BuildMessage(conv.Id, isDeleted: false));
            db.Messages.Add(BuildMessage(conv.Id, isDeleted: true));
            await db.SaveChangesAsync();
        });

        // Act
        var result = await RunQuery(r =>
            r.GetMessagesWithValidationAsync(user.Id, conv.Id, page: 1, pageSize: 10));

        // Assert
        result.Messages.Should().HaveCount(1);
        result.TotalCount.Should().Be(1);
    }

    // ======================== GetMessagesForConversationsAsync ========================

    [Fact]
    public async Task GetMessagesForConversationsAsync_WhenEmptyList_ShouldReturnEmptyDictionary()
    {
        // Act
        var result = await RunQuery(r =>
            r.GetMessagesForConversationsAsync([], messagesPerConversation: 5));

        // Assert
        result.Should().BeEmpty();
    }

    [Fact]
    public async Task GetMessagesForConversationsAsync_ShouldRespectMessagesPerConversationLimit()
    {
        // Arrange
        var conv = new Conv();

        await factory.SeedAsync(async db =>
        {
            db.Conversations.Add(conv);
            await db.SaveChangesAsync();

            for (var i = 0; i < 5; i++)
                db.Messages.Add(BuildMessage(conv.Id, sentAt: DateTime.UtcNow.AddMinutes(-i)));
            await db.SaveChangesAsync();
        });

        // Act
        var result = await RunQuery(r =>
            r.GetMessagesForConversationsAsync([conv.Id], messagesPerConversation: 3));

        // Assert
        result[conv.Id].Should().HaveCount(3);
    }

    [Fact]
    public async Task GetMessagesForConversationsAsync_ShouldExcludeDeletedMessages()
    {
        // Arrange
        var conv = new Conv();

        await factory.SeedAsync(async db =>
        {
            db.Conversations.Add(conv);
            await db.SaveChangesAsync();

            db.Messages.Add(BuildMessage(conv.Id, isDeleted: false));
            db.Messages.Add(BuildMessage(conv.Id, isDeleted: true));
            await db.SaveChangesAsync();
        });

        // Act
        var result = await RunQuery(r =>
            r.GetMessagesForConversationsAsync([conv.Id], messagesPerConversation: 10));

        // Assert
        result[conv.Id].Should().HaveCount(1);
    }

    // ======================== GetMessagesForConversationsWithValidationAsync ========================

    [Fact]
    public async Task GetMessagesForConversationsWithValidationAsync_WhenUserIsNotAccepted_ShouldReturnEmpty()
    {
        // Arrange
        var user = new UserBuilder().AsVerified().Build();
        var conv = new Conv();

        await factory.SeedAsync(async db =>
        {
            db.AppUsers.Add(user);
            db.Conversations.Add(conv);
            await db.SaveChangesAsync();

            db.ConversationParticipants.Add(new ConversationParticipant
            {
                UserId = user.Id,
                ConversationId = conv.Id,
                Status = ConversationStatus.Pending
            });
            db.Messages.Add(BuildMessage(conv.Id));
            await db.SaveChangesAsync();
        });

        // Act
        var result = await RunQuery(r =>
            r.GetMessagesForConversationsWithValidationAsync(user.Id, [conv.Id], messagesPerConversation: 10));

        // Assert
        result.Should().BeEmpty();
    }

    [Fact]
    public async Task GetMessagesForConversationsWithValidationAsync_WhenUserIsAccepted_ShouldReturnMessages()
    {
        // Arrange
        var user = new UserBuilder().AsVerified().Build();
        var conv = new Conv();

        await factory.SeedAsync(async db =>
        {
            db.AppUsers.Add(user);
            db.Conversations.Add(conv);
            await db.SaveChangesAsync();

            db.ConversationParticipants.Add(new ConversationParticipant
            {
                UserId = user.Id,
                ConversationId = conv.Id,
                Status = ConversationStatus.Accepted
            });
            db.Messages.Add(BuildMessage(conv.Id));
            await db.SaveChangesAsync();
        });

        // Act
        var result = await RunQuery(r =>
            r.GetMessagesForConversationsWithValidationAsync(user.Id, [conv.Id], messagesPerConversation: 10));

        // Assert
        result.Should().ContainKey(conv.Id);
        result[conv.Id].Should().HaveCount(1);
    }

    // ======================== GetAttachmentKeysForDownloadAsync ========================

    [Fact]
    public async Task GetAttachmentKeysForDownloadAsync_WhenUserIsNotAcceptedParticipant_ShouldReturnNull()
    {
        // Arrange
        var user = new UserBuilder().AsVerified().Build();
        var conv = new Conv();
        int attachmentId = 0;

        await factory.SeedAsync(async db =>
        {
            db.AppUsers.Add(user);
            db.Conversations.Add(conv);
            await db.SaveChangesAsync();

            db.ConversationParticipants.Add(new ConversationParticipant
            {
                UserId = user.Id,
                ConversationId = conv.Id,
                Status = ConversationStatus.Pending
            });

            var msg = BuildMessage(conv.Id);
            db.Messages.Add(msg);
            await db.SaveChangesAsync();

            var att = new MessageAttachment { MessageId = msg.Id, EncryptedFileStorageKey = "key", FileType = "image", OriginalFileName = "foto.jpg", KeyInfo = "{}", IV = "iv" };
            db.MessageAttachments.Add(att);
            await db.SaveChangesAsync();

            attachmentId = att.Id;
        });

        // Act
        var result = await RunQuery(r =>
            r.GetAttachmentKeysForDownloadAsync(user.Id, attachmentId));

        // Assert
        result.Should().BeNull();
    }

    [Fact]
    public async Task GetAttachmentKeysForDownloadAsync_WhenMessageIsDeleted_ShouldReturnNull()
    {
        // Arrange
        var user = new UserBuilder().AsVerified().Build();
        var conv = new Conv();
        int attachmentId = 0;

        await factory.SeedAsync(async db =>
        {
            db.AppUsers.Add(user);
            db.Conversations.Add(conv);
            await db.SaveChangesAsync();

            db.ConversationParticipants.Add(new ConversationParticipant
            {
                UserId = user.Id,
                ConversationId = conv.Id,
                Status = ConversationStatus.Accepted
            });

            var msg = BuildMessage(conv.Id, isDeleted: true);
            db.Messages.Add(msg);
            await db.SaveChangesAsync();

            var att = new MessageAttachment { MessageId = msg.Id, EncryptedFileStorageKey = "key", FileType = "image", OriginalFileName = "foto.jpg", KeyInfo = "{}", IV = "iv" };
            db.MessageAttachments.Add(att);
            await db.SaveChangesAsync();

            attachmentId = att.Id;
        });

        // Act
        var result = await RunQuery(r =>
            r.GetAttachmentKeysForDownloadAsync(user.Id, attachmentId));

        // Assert
        result.Should().BeNull();
    }

    [Fact]
    public async Task GetAttachmentKeysForDownloadAsync_WhenAcceptedParticipantAndMessageNotDeleted_ShouldReturnKeys()
    {
        // Arrange
        var user = new UserBuilder().AsVerified().Build();
        var conv = new Conv();
        int attachmentId = 0;

        await factory.SeedAsync(async db =>
        {
            db.AppUsers.Add(user);
            db.Conversations.Add(conv);
            await db.SaveChangesAsync();

            db.ConversationParticipants.Add(new ConversationParticipant
            {
                UserId = user.Id,
                ConversationId = conv.Id,
                Status = ConversationStatus.Accepted
            });

            var msg = BuildMessage(conv.Id, isDeleted: false);
            db.Messages.Add(msg);
            await db.SaveChangesAsync();

            var att = new MessageAttachment { MessageId = msg.Id, EncryptedFileStorageKey = "secret-key", FileType = "image", OriginalFileName = "foto.jpg", KeyInfo = "{}", IV = "iv" };
            db.MessageAttachments.Add(att);
            await db.SaveChangesAsync();

            attachmentId = att.Id;
        });

        // Act
        var result = await RunQuery(r =>
            r.GetAttachmentKeysForDownloadAsync(user.Id, attachmentId));

        // Assert
        result.Should().NotBeNull();
        result!.EncryptedFileStorageKey.Should().Be("secret-key");
    }

    // ======================== Hjelpemetoder ========================

    private static Message BuildMessage(int conversationId, bool isDeleted = false, DateTime? sentAt = null) =>
        new()
        {
            ConversationId = conversationId,
            KeyInfo = "{}",
            IV = "iv",
            IsDeleted = isDeleted,
            SentAt = sentAt ?? DateTime.UtcNow
        };

    private async Task<(Conv conv, Message message)> SeedConversationWithMessage(bool isDeleted)
    {
        var conv = new Conv();
        Message message = null!;

        await factory.SeedAsync(async db =>
        {
            db.Conversations.Add(conv);
            await db.SaveChangesAsync();

            message = BuildMessage(conv.Id, isDeleted: isDeleted);
            db.Messages.Add(message);
            await db.SaveChangesAsync();
        });

        return (conv, message);
    }

    private Task<T> RunQuery<T>(Func<MessageRepository, Task<T>> query) =>
        factory.QueryAsync(async db => await query(new MessageRepository(db)));
}
