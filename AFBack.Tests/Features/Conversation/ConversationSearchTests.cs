using AFBack.Features.Conversation.Enums;
using AFBack.Features.Conversation.Models;
using AFBack.Features.Conversation.Repository;
using AFBack.Tests.Builders;
using AFBack.Tests.Common;
using FluentAssertions;
using Conv = AFBack.Features.Conversation.Models.Conversation;

namespace AFBack.Tests.Features.Conversation;

[Collection(nameof(IntegrationTestsCollection))]
public class ConversationSearchTests(BackendApplicationFactory factory) : IAsyncLifetime
{
    public Task InitializeAsync() => Task.CompletedTask;

    public async Task DisposeAsync() => await factory.ResetDatabaseAsync();

    // ======================== FilterBySearchQuery — via GetConversationDtosBySearch ========================

    [Fact]
    public async Task GetConversationDtosBySearch_WhenQueryMatchesGroupName_ShouldReturnGroupConversation()
    {
        // Arrange
        var user  = new UserBuilder().AsVerified().Build();
        var group = new Conv { Type = ConversationType.GroupChat, GroupName = "Fotballaget" };

        await SeedAccepted(user, group);

        // Act
        var results = await RunQuery(r =>
            r.GetConversationDtosBySearch(user.Id, "Fotball", page: 1, pageSize: 10));

        // Assert
        results.Should().ContainSingle(c => c.Id == group.Id);
    }

    [Fact]
    public async Task GetConversationDtosBySearch_WhenQueryMatchesParticipantName_ShouldReturnConversation()
    {
        // Arrange
        var user  = new UserBuilder().AsVerified().Build();
        var other = new UserBuilder().WithFirstName("Kristoffer").WithLastName("Haug").AsVerified().Build();
        var conv  = new Conv { Type = ConversationType.DirectChat };

        await factory.SeedAsync(async db =>
        {
            db.AppUsers.AddRange(user, other);
            db.Conversations.Add(conv);
            await db.SaveChangesAsync();

            db.ConversationParticipants.AddRange(
                Accepted(user.Id,  conv.Id),
                Accepted(other.Id, conv.Id));
            await db.SaveChangesAsync();
        });

        // Act
        var results = await RunQuery(r =>
            r.GetConversationDtosBySearch(user.Id, "Kristoffer", page: 1, pageSize: 10));

        // Assert
        results.Should().ContainSingle(c => c.Id == conv.Id);
    }

    [Fact]
    public async Task GetConversationDtosBySearch_WhenConversationIsArchived_ShouldExclude()
    {
        // Arrange
        var user     = new UserBuilder().AsVerified().Build();
        var archived = new Conv { Type = ConversationType.GroupChat, GroupName = "Arkivert gruppe" };

        await factory.SeedAsync(async db =>
        {
            db.AppUsers.Add(user);
            db.Conversations.Add(archived);
            await db.SaveChangesAsync();

            db.ConversationParticipants.Add(new ConversationParticipant
            {
                UserId               = user.Id,
                ConversationId       = archived.Id,
                Status               = ConversationStatus.Accepted,
                ConversationArchived = true
            });
            await db.SaveChangesAsync();
        });

        // Act
        var results = await RunQuery(r =>
            r.GetConversationDtosBySearch(user.Id, "Arkivert", page: 1, pageSize: 10));

        // Assert
        results.Should().BeEmpty();
    }

    [Fact]
    public async Task GetConversationDtosBySearch_WhenStatusIsRejected_ShouldExclude()
    {
        // Arrange
        var user     = new UserBuilder().AsVerified().Build();
        var other    = new UserBuilder().WithFirstName("Avvist").WithLastName("Person").AsVerified().Build();
        var conv     = new Conv { Type = ConversationType.DirectChat };

        await factory.SeedAsync(async db =>
        {
            db.AppUsers.AddRange(user, other);
            db.Conversations.Add(conv);
            await db.SaveChangesAsync();

            db.ConversationParticipants.AddRange(
                new ConversationParticipant
                {
                    UserId         = user.Id,
                    ConversationId = conv.Id,
                    Status         = ConversationStatus.Rejected
                },
                Accepted(other.Id, conv.Id));
            await db.SaveChangesAsync();
        });

        // Act
        var results = await RunQuery(r =>
            r.GetConversationDtosBySearch(user.Id, "Avvist", page: 1, pageSize: 10));

        // Assert
        results.Should().BeEmpty();
    }

    // ======================== Hjelpemetoder ========================

    private static ConversationParticipant Accepted(string userId, int conversationId) =>
        new() { UserId = userId, ConversationId = conversationId, Status = ConversationStatus.Accepted };

    private async Task SeedAccepted(
        AFBack.Features.Auth.Models.AppUser user, Conv conv)
    {
        await factory.SeedAsync(async db =>
        {
            db.AppUsers.Add(user);
            db.Conversations.Add(conv);
            await db.SaveChangesAsync();

            db.ConversationParticipants.Add(Accepted(user.Id, conv.Id));
            await db.SaveChangesAsync();
        });
    }

    private Task<T> RunQuery<T>(Func<ConversationRepository, Task<T>> query) =>
        factory.QueryAsync(async db => await query(new ConversationRepository(db)));
}
