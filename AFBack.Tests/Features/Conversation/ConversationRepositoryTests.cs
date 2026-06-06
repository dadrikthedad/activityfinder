using AFBack.Features.Conversation.Enums;
using AFBack.Features.Conversation.Repository;
using Microsoft.EntityFrameworkCore;
using Conv = AFBack.Features.Conversation.Models.Conversation;
using ConversationParticipant = AFBack.Features.Conversation.Models.ConversationParticipant;
using AFBack.Tests.Builders;
using AFBack.Tests.Common;
using FluentAssertions;

namespace AFBack.Tests.Features.Conversation;

[Collection(nameof(IntegrationTestsCollection))]
public class ConversationRepositoryTests(BackendApplicationFactory factory) : IAsyncLifetime
{
    public Task InitializeAsync() => Task.CompletedTask;

    public async Task DisposeAsync() => await factory.ResetDatabaseAsync();

    // ======================== GetConversationBetweenUsersAsync ========================

    [Fact]
    public async Task GetConversationBetweenUsersAsync_WhenDirectConversationExists_ShouldReturnIt()
    {
        // Arrange
        var userA = new UserBuilder().AsVerified().Build();
        var userB = new UserBuilder().AsVerified().Build();
        var conv  = new Conv { Type = ConversationType.DirectChat };

        await factory.SeedAsync(async db =>
        {
            db.AppUsers.AddRange(userA, userB);
            db.Conversations.Add(conv);
            await db.SaveChangesAsync();

            db.ConversationParticipants.AddRange(
                Participant(userA.Id, conv.Id),
                Participant(userB.Id, conv.Id));
            await db.SaveChangesAsync();
        });

        // Act
        var result = await RunQuery(r => r.GetConversationBetweenUsersAsync(userA.Id, userB.Id));

        // Assert
        result.Should().NotBeNull();
        result!.Id.Should().Be(conv.Id);
    }

    [Fact]
    public async Task GetConversationBetweenUsersAsync_WhenOnlyGroupChatExists_ShouldReturnNull()
    {
        // Arrange — begge brukere er i en GroupChat, men ingen DirectChat
        var userA = new UserBuilder().AsVerified().Build();
        var userB = new UserBuilder().AsVerified().Build();
        var group = new Conv { Type = ConversationType.GroupChat };

        await factory.SeedAsync(async db =>
        {
            db.AppUsers.AddRange(userA, userB);
            db.Conversations.Add(group);
            await db.SaveChangesAsync();

            db.ConversationParticipants.AddRange(
                Participant(userA.Id, group.Id),
                Participant(userB.Id, group.Id));
            await db.SaveChangesAsync();
        });

        // Act
        var result = await RunQuery(r => r.GetConversationBetweenUsersAsync(userA.Id, userB.Id));

        // Assert
        result.Should().BeNull();
    }

    // ======================== GetActiveConversationsAsync / Count ========================

    [Fact]
    public async Task GetActiveConversationsAsync_ShouldReturnOnlyAcceptedAndNonArchivedConversations()
    {
        // Arrange
        var user = new UserBuilder().AsVerified().Build();
        var active   = new Conv();
        var pending  = new Conv();
        var archived = new Conv();

        await SeedParticipant(user, active,   ConversationStatus.Accepted, archived: false);
        await SeedParticipant(user, pending,  ConversationStatus.Pending,  archived: false);
        await SeedParticipant(user, archived, ConversationStatus.Accepted, archived: true);

        // Act
        var results = await RunQuery(r => r.GetActiveConversationsAsync(user.Id, page: 1, pageSize: 10));

        // Assert
        results.Should().ContainSingle(c => c.Id == active.Id);
        results.Should().NotContain(c => c.Id == pending.Id);
        results.Should().NotContain(c => c.Id == archived.Id);
    }

    [Fact]
    public async Task GetActiveConversationsCountAsync_ShouldExcludeArchivedAndNonAccepted()
    {
        // Arrange
        var user = new UserBuilder().AsVerified().Build();
        var active   = new Conv();
        var pending  = new Conv();
        var archived = new Conv();

        await SeedParticipant(user, active,   ConversationStatus.Accepted, archived: false);
        await SeedParticipant(user, pending,  ConversationStatus.Pending,  archived: false);
        await SeedParticipant(user, archived, ConversationStatus.Accepted, archived: true);

        // Act
        var count = await RunQuery(r => r.GetActiveConversationsCountAsync(user.Id));

        // Assert
        count.Should().Be(1);
    }

    // ======================== GetPendingConversationsAsync / Count ========================

    [Fact]
    public async Task GetPendingConversationsAsync_ShouldReturnOnlyPendingConversations()
    {
        // Arrange
        var user    = new UserBuilder().AsVerified().Build();
        var pending  = new Conv();
        var accepted = new Conv();

        await SeedParticipant(user, pending,  ConversationStatus.Pending);
        await SeedParticipant(user, accepted, ConversationStatus.Accepted);

        // Act
        var results = await RunQuery(r => r.GetPendingConversationsAsync(user.Id, page: 1, pageSize: 10));

        // Assert
        results.Should().ContainSingle(c => c.Id == pending.Id);
        results.Should().NotContain(c => c.Id == accepted.Id);
    }

    [Fact]
    public async Task GetPendingConversationsCountAsync_ShouldCountOnlyPending()
    {
        // Arrange
        var user = new UserBuilder().AsVerified().Build();
        var pending1 = new Conv();
        var pending2 = new Conv();
        var accepted = new Conv();

        await SeedParticipant(user, pending1, ConversationStatus.Pending);
        await SeedParticipant(user, pending2, ConversationStatus.Pending);
        await SeedParticipant(user, accepted, ConversationStatus.Accepted);

        // Act
        var count = await RunQuery(r => r.GetPendingConversationsCountAsync(user.Id));

        // Assert
        count.Should().Be(2);
    }

    // ======================== GetArchivedConversationsAsync / Count ========================

    [Fact]
    public async Task GetArchivedConversationsAsync_ShouldReturnOnlyArchivedConversations()
    {
        // Arrange
        var user     = new UserBuilder().AsVerified().Build();
        var archived  = new Conv();
        var active    = new Conv();

        await SeedParticipant(user, archived, ConversationStatus.Accepted, archived: true);
        await SeedParticipant(user, active,   ConversationStatus.Accepted, archived: false);

        // Act
        var results = await RunQuery(r => r.GetArchivedConversationsAsync(user.Id, page: 1, pageSize: 10));

        // Assert
        results.Should().ContainSingle(c => c.Id == archived.Id);
        results.Should().NotContain(c => c.Id == active.Id);
    }

    [Fact]
    public async Task GetArchivedConversationsCountAsync_ShouldCountOnlyArchived()
    {
        // Arrange
        var user     = new UserBuilder().AsVerified().Build();
        var archived = new Conv();
        var active   = new Conv();

        await SeedParticipant(user, archived, ConversationStatus.Accepted, archived: true);
        await SeedParticipant(user, active,   ConversationStatus.Accepted, archived: false);

        // Act
        var count = await RunQuery(r => r.GetArchivedConversationsCountAsync(user.Id));

        // Assert
        count.Should().Be(1);
    }

    // ======================== GetRejectedConversationsAsync ========================

    [Fact]
    public async Task GetRejectedConversationsAsync_ShouldReturnOnlyRejectedConversations()
    {
        // Arrange
        var user     = new UserBuilder().AsVerified().Build();
        var rejected = new Conv();
        var pending  = new Conv();

        await SeedParticipant(user, rejected, ConversationStatus.Rejected);
        await SeedParticipant(user, pending,  ConversationStatus.Pending);

        // Act
        var results = await RunQuery(r => r.GetRejectedConversationsAsync(user.Id, page: 1, pageSize: 10));

        // Assert
        results.Should().ContainSingle(c => c.Id == rejected.Id);
        results.Should().NotContain(c => c.Id == pending.Id);
    }

    // ======================== GetAllConversationPartnerIdsAsync ========================

    [Fact]
    public async Task GetAllConversationPartnerIdsAsync_ShouldExcludeSelf()
    {
        // Arrange
        var user  = new UserBuilder().AsVerified().Build();
        var other = new UserBuilder().AsVerified().Build();
        var conv  = new Conv();

        await factory.SeedAsync(async db =>
        {
            db.AppUsers.AddRange(user, other);
            db.Conversations.Add(conv);
            await db.SaveChangesAsync();

            db.ConversationParticipants.AddRange(
                Participant(user.Id,  conv.Id, ConversationStatus.Accepted),
                Participant(other.Id, conv.Id, ConversationStatus.Accepted));
            await db.SaveChangesAsync();
        });

        // Act
        var result = await RunQuery(r => r.GetAllConversationPartnerIdsAsync(user.Id));

        // Assert
        result.Should().NotContain(user.Id);
        result.Should().Contain(other.Id);
    }

    [Fact]
    public async Task GetAllConversationPartnerIdsAsync_ShouldExcludeRejectedParticipants()
    {
        // Arrange
        var user     = new UserBuilder().AsVerified().Build();
        var rejected = new UserBuilder().AsVerified().Build();
        var conv     = new Conv();

        await factory.SeedAsync(async db =>
        {
            db.AppUsers.AddRange(user, rejected);
            db.Conversations.Add(conv);
            await db.SaveChangesAsync();

            db.ConversationParticipants.AddRange(
                Participant(user.Id,     conv.Id, ConversationStatus.Accepted),
                Participant(rejected.Id, conv.Id, ConversationStatus.Rejected));
            await db.SaveChangesAsync();
        });

        // Act
        var result = await RunQuery(r => r.GetAllConversationPartnerIdsAsync(user.Id));

        // Assert
        result.Should().NotContain(rejected.Id);
    }

    [Fact]
    public async Task GetAllConversationPartnerIdsAsync_WhenPartnerInMultipleConversations_ShouldReturnDistinct()
    {
        // Arrange
        var user  = new UserBuilder().AsVerified().Build();
        var other = new UserBuilder().AsVerified().Build();
        var conv1 = new Conv();
        var conv2 = new Conv();

        await factory.SeedAsync(async db =>
        {
            db.AppUsers.AddRange(user, other);
            db.Conversations.AddRange(conv1, conv2);
            await db.SaveChangesAsync();

            db.ConversationParticipants.AddRange(
                Participant(user.Id,  conv1.Id, ConversationStatus.Accepted),
                Participant(other.Id, conv1.Id, ConversationStatus.Accepted),
                Participant(user.Id,  conv2.Id, ConversationStatus.Accepted),
                Participant(other.Id, conv2.Id, ConversationStatus.Accepted));
            await db.SaveChangesAsync();
        });

        // Act
        var result = await RunQuery(r => r.GetAllConversationPartnerIdsAsync(user.Id));

        // Assert
        result.Should().ContainSingle(id => id == other.Id);
    }

    // ======================== GetAcceptedParticipantIdsAsync ========================

    [Fact]
    public async Task GetAcceptedParticipantIdsAsync_ShouldReturnOnlyAcceptedParticipants()
    {
        // Arrange
        var accepted = new UserBuilder().AsVerified().Build();
        var pending  = new UserBuilder().AsVerified().Build();
        var conv     = new Conv();

        await factory.SeedAsync(async db =>
        {
            db.AppUsers.AddRange(accepted, pending);
            db.Conversations.Add(conv);
            await db.SaveChangesAsync();

            db.ConversationParticipants.AddRange(
                Participant(accepted.Id, conv.Id, ConversationStatus.Accepted),
                Participant(pending.Id,  conv.Id, ConversationStatus.Pending));
            await db.SaveChangesAsync();
        });

        // Act
        var result = await RunQuery(r => r.GetAcceptedParticipantIdsAsync(conv.Id));

        // Assert
        result.Should().Contain(accepted.Id);
        result.Should().NotContain(pending.Id);
    }

    // ======================== GetUserAcceptedConversationIdsAsync ========================

    [Fact]
    public async Task GetUserAcceptedConversationIdsAsync_WhenEmptyList_ShouldReturnEmptySet()
    {
        // Act
        var result = await RunQuery(r =>
            r.GetUserAcceptedConversationIdsAsync("any-user", []));

        // Assert
        result.Should().BeEmpty();
    }

    [Fact]
    public async Task GetUserAcceptedConversationIdsAsync_ShouldOnlyIncludeAcceptedConversations()
    {
        // Arrange
        var user     = new UserBuilder().AsVerified().Build();
        var accepted = new Conv();
        var pending  = new Conv();

        await SeedParticipant(user, accepted, ConversationStatus.Accepted);
        await SeedParticipant(user, pending,  ConversationStatus.Pending);

        // Act
        var result = await RunQuery(r =>
            r.GetUserAcceptedConversationIdsAsync(user.Id, [accepted.Id, pending.Id]));

        // Assert
        result.Should().Contain(accepted.Id);
        result.Should().NotContain(pending.Id);
    }

    // ======================== GetNextCreatorCandidateAsync ========================

    [Fact]
    public async Task GetNextCreatorCandidateAsync_ShouldExcludeSpecifiedUser()
    {
        // Arrange
        var leaving   = new UserBuilder().AsVerified().Build();
        var remaining = new UserBuilder().AsVerified().Build();
        var conv      = new Conv();

        await factory.SeedAsync(async db =>
        {
            db.AppUsers.AddRange(leaving, remaining);
            db.Conversations.Add(conv);
            await db.SaveChangesAsync();

            db.ConversationParticipants.AddRange(
                Participant(leaving.Id,   conv.Id, ConversationStatus.Accepted),
                Participant(remaining.Id, conv.Id, ConversationStatus.Accepted));
            await db.SaveChangesAsync();
        });

        // Act
        var result = await RunQuery(r => r.GetNextCreatorCandidateAsync(conv.Id, leaving.Id));

        // Assert
        result.Should().NotBeNull();
        result!.UserId.Should().Be(remaining.Id);
    }

    [Fact]
    public async Task GetNextCreatorCandidateAsync_ShouldReturnOldestMemberFirst()
    {
        // Arrange
        var leaving = new UserBuilder().AsVerified().Build();
        var oldest  = new UserBuilder().AsVerified().Build();
        var newest  = new UserBuilder().AsVerified().Build();
        var conv    = new Conv();

        await factory.SeedAsync(async db =>
        {
            db.AppUsers.AddRange(leaving, oldest, newest);
            db.Conversations.Add(conv);
            await db.SaveChangesAsync();

            db.ConversationParticipants.AddRange(
                Participant(leaving.Id, conv.Id, ConversationStatus.Accepted, invitedAt: DateTime.UtcNow.AddDays(-3)),
                Participant(oldest.Id,  conv.Id, ConversationStatus.Accepted, invitedAt: DateTime.UtcNow.AddDays(-2)),
                Participant(newest.Id,  conv.Id, ConversationStatus.Accepted, invitedAt: DateTime.UtcNow.AddDays(-1)));
            await db.SaveChangesAsync();
        });

        // Act
        var result = await RunQuery(r => r.GetNextCreatorCandidateAsync(conv.Id, leaving.Id));

        // Assert
        result!.UserId.Should().Be(oldest.Id);
    }

    [Fact]
    public async Task GetNextCreatorCandidateAsync_ShouldExcludeNonAcceptedParticipants()
    {
        // Arrange
        var leaving = new UserBuilder().AsVerified().Build();
        var pending = new UserBuilder().AsVerified().Build();
        var conv    = new Conv();

        await factory.SeedAsync(async db =>
        {
            db.AppUsers.AddRange(leaving, pending);
            db.Conversations.Add(conv);
            await db.SaveChangesAsync();

            db.ConversationParticipants.AddRange(
                Participant(leaving.Id, conv.Id, ConversationStatus.Accepted),
                Participant(pending.Id, conv.Id, ConversationStatus.Pending));
            await db.SaveChangesAsync();
        });

        // Act
        var result = await RunQuery(r => r.GetNextCreatorCandidateAsync(conv.Id, leaving.Id));

        // Assert
        result.Should().BeNull();
    }

    // ======================== Hjelpemetoder ========================

    private static ConversationParticipant Participant(
        string userId,
        int conversationId,
        ConversationStatus status = ConversationStatus.Accepted,
        bool archived = false,
        DateTime? invitedAt = null) =>
        new()
        {
            UserId               = userId,
            ConversationId       = conversationId,
            Status               = status,
            ConversationArchived = archived,
            InvitedAt            = invitedAt ?? DateTime.UtcNow
        };

    private async Task SeedParticipant(
        AFBack.Features.Auth.Models.AppUser user,
        Conv conv,
        ConversationStatus status,
        bool archived = false)
    {
        await factory.SeedAsync(async db =>
        {
            if (!await db.AppUsers.AnyAsync(u => u.Id == user.Id))
                db.AppUsers.Add(user);
            db.Conversations.Add(conv);
            await db.SaveChangesAsync();

            db.ConversationParticipants.Add(Participant(user.Id, conv.Id, status, archived));
            await db.SaveChangesAsync();
        });
    }

    private Task<T> RunQuery<T>(Func<ConversationRepository, Task<T>> query) =>
        factory.QueryAsync(async db => await query(new ConversationRepository(db)));
}
