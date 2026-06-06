using AFBack.Features.Conversation.Models;
using AFBack.Features.Messaging.Models;
using AFBack.Features.Reactions.Models;
using AFBack.Features.Reactions.Repositories;
using AFBack.Tests.Builders;
using AFBack.Tests.Common;
using FluentAssertions;
using Conv = AFBack.Features.Conversation.Models.Conversation;

namespace AFBack.Tests.Features.Reactions;

[Collection(nameof(IntegrationTestsCollection))]
public class ReactionRepositoryTests(BackendApplicationFactory factory) : IAsyncLifetime
{
    public Task InitializeAsync() => Task.CompletedTask;

    public async Task DisposeAsync() => await factory.ResetDatabaseAsync();

    // ======================== GetUserReactionOnMessageAsync ========================

    [Fact]
    public async Task GetUserReactionOnMessageAsync_WhenReactionExists_ShouldReturnIt()
    {
        // Arrange
        var user = new UserBuilder().AsVerified().Build();
        var (conv, message) = await SeedMessage(user, isDeleted: false, isSystem: false);

        await factory.SeedAsync(async db =>
        {
            db.Reactions.Add(new Reaction { MessageId = message.Id, UserId = user.Id, Emoji = "👍" });
            await db.SaveChangesAsync();
        });

        // Act
        var result = await RunQuery(r =>
            r.GetUserReactionOnMessageAsync(user.Id, message.Id, conv.Id));

        // Assert
        result.Should().NotBeNull();
        result!.Emoji.Should().Be("👍");
    }

    [Fact]
    public async Task GetUserReactionOnMessageAsync_WhenMessageIsDeleted_ShouldReturnNull()
    {
        // Arrange
        var user = new UserBuilder().AsVerified().Build();
        var (conv, message) = await SeedMessage(user, isDeleted: true, isSystem: false);

        await factory.SeedAsync(async db =>
        {
            db.Reactions.Add(new Reaction { MessageId = message.Id, UserId = user.Id, Emoji = "👍" });
            await db.SaveChangesAsync();
        });

        // Act
        var result = await RunQuery(r =>
            r.GetUserReactionOnMessageAsync(user.Id, message.Id, conv.Id));

        // Assert
        result.Should().BeNull();
    }

    [Fact]
    public async Task GetUserReactionOnMessageAsync_WhenMessageIsSystemMessage_ShouldReturnNull()
    {
        // Arrange
        var user = new UserBuilder().AsVerified().Build();
        var (conv, message) = await SeedMessage(user, isDeleted: false, isSystem: true);

        await factory.SeedAsync(async db =>
        {
            db.Reactions.Add(new Reaction { MessageId = message.Id, UserId = user.Id, Emoji = "👍" });
            await db.SaveChangesAsync();
        });

        // Act
        var result = await RunQuery(r =>
            r.GetUserReactionOnMessageAsync(user.Id, message.Id, conv.Id));

        // Assert
        result.Should().BeNull();
    }

    // ======================== Hjelpemetoder ========================

    private async Task<(Conv conv, Message message)> SeedMessage(
        AFBack.Features.Auth.Models.AppUser user, bool isDeleted, bool isSystem)
    {
        var conv = new Conv();
        Message message = null!;

        await factory.SeedAsync(async db =>
        {
            db.AppUsers.Add(user);
            db.Conversations.Add(conv);
            await db.SaveChangesAsync();

            message = new Message
            {
                ConversationId  = conv.Id,
                KeyInfo         = "{}",
                IV              = "iv",
                IsDeleted       = isDeleted,
                IsSystemMessage = isSystem
            };
            db.Messages.Add(message);
            await db.SaveChangesAsync();
        });

        return (conv, message);
    }

    private Task<T> RunQuery<T>(Func<ReactionRepository, Task<T>> query) =>
        factory.QueryAsync(async db => await query(new ReactionRepository(db)));
}
