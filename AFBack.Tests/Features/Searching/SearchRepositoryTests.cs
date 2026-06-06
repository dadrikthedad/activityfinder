using AFBack.Features.Blocking.Models;
using AFBack.Features.Conversation.Models;
using AFBack.Features.Searching.Repositories;
using Conv = AFBack.Features.Conversation.Models.Conversation;
using AFBack.Tests.Builders;
using AFBack.Tests.Common;
using FluentAssertions;

namespace AFBack.Tests.Features.Searching;

[Collection(nameof(IntegrationTestsCollection))]
public class SearchRepositoryTests(BackendApplicationFactory factory) : IAsyncLifetime
{
    public Task InitializeAsync() => Task.CompletedTask;

    public async Task DisposeAsync() => await factory.ResetDatabaseAsync();

    // ======================== SearchUsersAsync ========================
    // Merk: krever profil per bruker — INNER JOIN mot Profiles-tabellen

    [Fact]
    public async Task SearchUsersAsync_WhenQueryMatchesFullName_ShouldReturnUser()
    {
        // Arrange
        var requester = BuildUserWithProfile("req");
        var match     = BuildUserWithProfile("Ali Vold");

        await SeedUsers(requester, match);

        // Act
        var results = await RunSearch(r => r.SearchUsersAsync("ali", requester.Id, null, 10));

        // Assert
        results.Should().ContainSingle(r => r.Id == match.Id);
    }

    [Fact]
    public async Task SearchUsersAsync_WhenQueryIsCaseInsensitive_ShouldReturnUser()
    {
        // Arrange
        var requester = BuildUserWithProfile("req");
        var match     = BuildUserWithProfile("Kari Hansen");

        await SeedUsers(requester, match);

        // Act
        var results = await RunSearch(r => r.SearchUsersAsync("KARI", requester.Id, null, 10));

        // Assert
        results.Should().ContainSingle(r => r.Id == match.Id);
    }

    [Fact]
    public async Task SearchUsersAsync_WhenQueryDoesNotMatch_ShouldReturnEmptyList()
    {
        // Arrange
        var requester = BuildUserWithProfile("req");
        var other     = BuildUserWithProfile("Ola Nordmann");

        await SeedUsers(requester, other);

        // Act
        var results = await RunSearch(r => r.SearchUsersAsync("xyz", requester.Id, null, 10));

        // Assert
        results.Should().BeEmpty();
    }

    [Fact]
    public async Task SearchUsersAsync_WhenUserIsRequester_ShouldExcludeSelf()
    {
        // Arrange
        var requester = BuildUserWithProfile("Test Bruker");

        await SeedUsers(requester);

        // Act
        var results = await RunSearch(r => r.SearchUsersAsync("Test", requester.Id, null, 10));

        // Assert
        results.Should().NotContain(r => r.Id == requester.Id);
    }

    [Fact]
    public async Task SearchUsersAsync_WhenUserHasBlockedRequester_ShouldExcludeBlocker()
    {
        // Arrange — blocker har blokkert oss, vi skal ikke se blocker i soket
        var requester = BuildUserWithProfile("req");
        var blocker   = BuildUserWithProfile("Per Blocker");

        await factory.SeedAsync(async db =>
        {
            db.AppUsers.AddRange(requester, blocker);
            db.UserBlocks.Add(new UserBlock { BlockerId = blocker.Id, BlockedUserId = requester.Id });
            await db.SaveChangesAsync();
        });

        // Act
        var results = await RunSearch(r => r.SearchUsersAsync("Per", requester.Id, null, 10));

        // Assert
        results.Should().NotContain(r => r.Id == blocker.Id);
    }

    [Fact]
    public async Task SearchUsersAsync_WhenRequesterHasBlockedUser_ShouldStillShowUser()
    {
        // Arrange — vi har blokkert user, men SearchUsersAsync filtrerer bare den andre retningen
        var requester = BuildUserWithProfile("req");
        var blocked   = BuildUserWithProfile("Bjorn Blokkert");

        await factory.SeedAsync(async db =>
        {
            db.AppUsers.AddRange(requester, blocked);
            db.UserBlocks.Add(new UserBlock { BlockerId = requester.Id, BlockedUserId = blocked.Id });
            await db.SaveChangesAsync();
        });

        // Act
        var results = await RunSearch(r => r.SearchUsersAsync("Bjorn", requester.Id, null, 10));

        // Assert — brukere vi har blokkert er synlige i vanlig sok (bare inverse retning filtreres)
        results.Should().ContainSingle(r => r.Id == blocked.Id);
    }

    [Fact]
    public async Task SearchUsersAsync_ShouldReturnCountryCodeFromProfile()
    {
        // Arrange
        var requester = BuildUserWithProfile("req");
        var userId    = Guid.NewGuid().ToString();
        var profile   = new UserProfileBuilder().ForUser(userId).WithCountryCode("SE").Build();
        var match     = new UserBuilder().WithId(userId).WithFirstName("Lars").AsVerified()
                            .WithProfile(profile).Build();

        await SeedUsers(requester, match);

        // Act
        var results = await RunSearch(r => r.SearchUsersAsync("Lars", requester.Id, null, 10));

        // Assert
        results.Should().ContainSingle();
        results[0].CountryCode.Should().Be("SE");
    }

    [Fact]
    public async Task SearchUsersAsync_WhenCursorProvided_ShouldSkipPreviousResults()
    {
        // Arrange — tre brukere med navn som sorterer alfabetisk
        var requester = BuildUserWithProfile("req");
        var userA     = BuildUserWithProfile("Anna Ask");
        var userB     = BuildUserWithProfile("Bjorn Berg");
        var userC     = BuildUserWithProfile("Cecile Cato");

        await SeedUsers(requester, userA, userB, userC);

        // Hent side 1 (pageSize=2, returnerer 3 for HasMore)
        var page1 = await RunSearch(r => r.SearchUsersAsync("a", requester.Id, null, 2));
        // Cursor etter siste element pa side 1 (ProximityLevel er alltid 0)
        var lastOnPage1 = page1[1];
        var cursor = $"0|{lastOnPage1.FullName}|{lastOnPage1.Id}";

        // Act — side 2
        var page2 = await RunSearch(r => r.SearchUsersAsync("a", requester.Id, cursor, 10));

        // Assert — side 2 skal ikke inneholde noen fra side 1
        page2.Should().NotContain(r => r.Id == page1[0].Id);
        page2.Should().NotContain(r => r.Id == page1[1].Id);
    }

    [Fact]
    public async Task SearchUsersAsync_ShouldReturnPageSizePlusOneResults()
    {
        // Arrange — seed pageSize+2 brukere slik at +1-logikken utloses
        var requester = BuildUserWithProfile("req");
        var matches   = Enumerable.Range(1, 6)
            .Select(i => BuildUserWithProfile($"Alma {i:D2}"))
            .ToArray();

        await SeedUsers([requester, .. matches]);

        // Act
        var results = await RunSearch(r => r.SearchUsersAsync("Alma", requester.Id, null, 5));

        // Assert — returnerer 6 (5+1) for at kalleren kan oppdage HasMore
        results.Should().HaveCount(6);
    }

    // ======================== QuickSearchUsersAsync ========================

    [Fact]
    public async Task QuickSearchUsersAsync_WhenQueryMatchesFullName_ShouldReturnUser()
    {
        // Arrange
        var requester = new UserBuilder().AsVerified().Build();
        var match     = new UserBuilder().WithFirstName("Ingrid").WithLastName("Lie").AsVerified().Build();

        await SeedUsers(requester, match);

        // Act
        var results = await RunSearch(r => r.QuickSearchUsersAsync("Ingrid", requester.Id, null, 10));

        // Assert
        results.Should().ContainSingle(r => r.Id == match.Id);
    }

    [Fact]
    public async Task QuickSearchUsersAsync_WhenUserIsRequester_ShouldExcludeSelf()
    {
        // Arrange
        var requester = new UserBuilder().WithFirstName("Solo").AsVerified().Build();

        await SeedUsers(requester);

        // Act
        var results = await RunSearch(r => r.QuickSearchUsersAsync("Solo", requester.Id, null, 10));

        // Assert
        results.Should().NotContain(r => r.Id == requester.Id);
    }

    [Fact]
    public async Task QuickSearchUsersAsync_WhenUserHasBlockedRequester_ShouldExcludeBlocker()
    {
        // Arrange
        var requester = new UserBuilder().AsVerified().Build();
        var blocker   = new UserBuilder().WithFirstName("Tore").AsVerified().Build();

        await factory.SeedAsync(async db =>
        {
            db.AppUsers.AddRange(requester, blocker);
            db.UserBlocks.Add(new UserBlock { BlockerId = blocker.Id, BlockedUserId = requester.Id });
            await db.SaveChangesAsync();
        });

        // Act
        var results = await RunSearch(r => r.QuickSearchUsersAsync("Tore", requester.Id, null, 10));

        // Assert
        results.Should().NotContain(r => r.Id == blocker.Id);
    }

    [Fact]
    public async Task QuickSearchUsersAsync_WhenCursorIsLastUserId_ShouldSkipPreviousResults()
    {
        // Arrange
        var requester = new UserBuilder().AsVerified().Build();
        // Navn som sorterer deterministisk
        var userA = new UserBuilder().WithFirstName("Alma").WithLastName("Ask").AsVerified().Build();
        var userB = new UserBuilder().WithFirstName("Bjorn").WithLastName("Berg").AsVerified().Build();
        var userC = new UserBuilder().WithFirstName("Cecile").WithLastName("Cato").AsVerified().Build();

        await SeedUsers(requester, userA, userB, userC);

        // Side 1 — hent 1 resultat
        var page1 = await RunSearch(r => r.QuickSearchUsersAsync("a", requester.Id, null, 1));
        var cursorId = page1[0].Id; // QuickSearch cursor er userId til siste element

        // Act — side 2 bruker cursoren
        var page2 = await RunSearch(r => r.QuickSearchUsersAsync("a", requester.Id, cursorId, 10));

        // Assert
        page2.Should().NotContain(r => r.Id == page1[0].Id);
    }

    [Fact]
    public async Task QuickSearchUsersAsync_ShouldReturnPageSizePlusOneResults()
    {
        // Arrange
        var requester = new UserBuilder().AsVerified().Build();
        var matches   = Enumerable.Range(1, 6)
            .Select(i => new UserBuilder().WithFirstName($"Nora {i:D2}").AsVerified().Build())
            .ToArray();

        await SeedUsers([requester, .. matches]);

        // Act
        var results = await RunSearch(r => r.QuickSearchUsersAsync("Nora", requester.Id, null, 5));

        // Assert
        results.Should().HaveCount(6);
    }

    // ======================== SearchUsersForGroupInviteAsync ========================

    [Fact]
    public async Task SearchUsersForGroupInviteAsync_WhenQueryMatches_ShouldReturnUser()
    {
        // Arrange
        var requester = new UserBuilder().AsVerified().Build();
        var match     = new UserBuilder().WithFirstName("Frida").AsVerified().Build();

        await SeedUsers(requester, match);

        // Act
        var results = await RunSearch(r =>
            r.SearchUsersForGroupInviteAsync("Frida", requester.Id, null, null, 10));

        // Assert
        results.Should().ContainSingle(r => r.Id == match.Id);
    }

    [Fact]
    public async Task SearchUsersForGroupInviteAsync_WhenUserIsExistingMember_ShouldExclude()
    {
        // Arrange
        var requester = new UserBuilder().AsVerified().Build();
        var member    = new UserBuilder().WithFirstName("Gruppe").AsVerified().Build();

        var conversation = new Conv { Type = AFBack.Features.Conversation.Enums.ConversationType.GroupChat };

        await factory.SeedAsync(async db =>
        {
            db.AppUsers.AddRange(requester, member);
            db.Conversations.Add(conversation);
            await db.SaveChangesAsync();

            db.ConversationParticipants.Add(new ConversationParticipant
            {
                UserId = member.Id,
                ConversationId = conversation.Id
            });
            await db.SaveChangesAsync();
        });

        // Act
        var results = await RunSearch(r =>
            r.SearchUsersForGroupInviteAsync("Gruppe", requester.Id, conversation.Id, null, 10));

        // Assert
        results.Should().NotContain(r => r.Id == member.Id);
    }

    [Fact]
    public async Task SearchUsersForGroupInviteAsync_WhenUserHasLeftGroup_ShouldExclude()
    {
        // Arrange
        var requester = new UserBuilder().AsVerified().Build();
        var leftUser  = new UserBuilder().WithFirstName("Gikk").AsVerified().Build();

        var conversation = new Conv { Type = AFBack.Features.Conversation.Enums.ConversationType.GroupChat };

        await factory.SeedAsync(async db =>
        {
            db.AppUsers.AddRange(requester, leftUser);
            db.Conversations.Add(conversation);
            await db.SaveChangesAsync();

            db.ConversationLeftRecords.Add(new ConversationLeftRecord
            {
                UserId = leftUser.Id,
                ConversationId = conversation.Id
            });
            await db.SaveChangesAsync();
        });

        // Act
        var results = await RunSearch(r =>
            r.SearchUsersForGroupInviteAsync("Gikk", requester.Id, conversation.Id, null, 10));

        // Assert
        results.Should().NotContain(r => r.Id == leftUser.Id);
    }

    [Fact]
    public async Task SearchUsersForGroupInviteAsync_WhenRequesterHasBlockedUser_ShouldExclude()
    {
        // Arrange — vi har blokkert user (GroupInvite filtrerer begge retninger)
        var requester = new UserBuilder().AsVerified().Build();
        var blocked   = new UserBuilder().WithFirstName("Blokkert").AsVerified().Build();

        await factory.SeedAsync(async db =>
        {
            db.AppUsers.AddRange(requester, blocked);
            db.UserBlocks.Add(new UserBlock { BlockerId = requester.Id, BlockedUserId = blocked.Id });
            await db.SaveChangesAsync();
        });

        // Act
        var results = await RunSearch(r =>
            r.SearchUsersForGroupInviteAsync("Blokkert", requester.Id, null, null, 10));

        // Assert
        results.Should().NotContain(r => r.Id == blocked.Id);
    }

    [Fact]
    public async Task SearchUsersForGroupInviteAsync_WhenUserHasBlockedRequester_ShouldExclude()
    {
        // Arrange — user har blokkert oss
        var requester = new UserBuilder().AsVerified().Build();
        var blocker   = new UserBuilder().WithFirstName("Hagrid").AsVerified().Build();

        await factory.SeedAsync(async db =>
        {
            db.AppUsers.AddRange(requester, blocker);
            db.UserBlocks.Add(new UserBlock { BlockerId = blocker.Id, BlockedUserId = requester.Id });
            await db.SaveChangesAsync();
        });

        // Act
        var results = await RunSearch(r =>
            r.SearchUsersForGroupInviteAsync("Hagrid", requester.Id, null, null, 10));

        // Assert
        results.Should().NotContain(r => r.Id == blocker.Id);
    }

    [Fact]
    public async Task SearchUsersForGroupInviteAsync_WhenConversationIdIsNull_ShouldNotFilterByMembership()
    {
        // Arrange — ingen gruppe-ID betyr ingen filtrering pa medlemmer
        var requester = new UserBuilder().AsVerified().Build();
        var user      = new UserBuilder().WithFirstName("Fri").AsVerified().Build();

        await SeedUsers(requester, user);

        // Act — conversationId = null
        var results = await RunSearch(r =>
            r.SearchUsersForGroupInviteAsync("Fri", requester.Id, null, null, 10));

        // Assert
        results.Should().ContainSingle(r => r.Id == user.Id);
    }

    [Fact]
    public async Task SearchUsersForGroupInviteAsync_WhenCursorProvided_ShouldSkipPreviousResults()
    {
        // Arrange
        var requester = new UserBuilder().AsVerified().Build();
        var userA     = new UserBuilder().WithFirstName("Abel").WithLastName("Ask").AsVerified().Build();
        var userB     = new UserBuilder().WithFirstName("Bente").WithLastName("Berg").AsVerified().Build();
        var userC     = new UserBuilder().WithFirstName("Clara").WithLastName("Cato").AsVerified().Build();

        await SeedUsers(requester, userA, userB, userC);

        // Side 1 — pageSize=1
        var page1 = await RunSearch(r =>
            r.SearchUsersForGroupInviteAsync("a", requester.Id, null, null, 1));
        var last = page1[0];
        var cursor = $"{last.FullName}|{last.Id}";

        // Act — side 2
        var page2 = await RunSearch(r =>
            r.SearchUsersForGroupInviteAsync("a", requester.Id, null, cursor, 10));

        // Assert
        page2.Should().NotContain(r => r.Id == last.Id);
    }

    [Fact]
    public async Task SearchUsersForGroupInviteAsync_ShouldReturnPageSizePlusOneResults()
    {
        // Arrange
        var requester = new UserBuilder().AsVerified().Build();
        var matches   = Enumerable.Range(1, 6)
            .Select(i => new UserBuilder().WithFirstName($"Erik {i:D2}").AsVerified().Build())
            .ToArray();

        await SeedUsers([requester, .. matches]);

        // Act
        var results = await RunSearch(r =>
            r.SearchUsersForGroupInviteAsync("Erik", requester.Id, null, null, 5));

        // Assert
        results.Should().HaveCount(6);
    }

    // ======================== Hjelpemetoder ========================

    // Bygger bruker med profil (paakrevd for SearchUsersAsync pga INNER JOIN)
    private static AFBack.Features.Auth.Models.AppUser BuildUserWithProfile(string fullName)
    {
        var parts  = fullName.Split(' ', 2);
        var first  = parts[0];
        var last   = parts.Length > 1 ? parts[1] : "Testbruker";
        var userId = Guid.NewGuid().ToString();
        var profile = new UserProfileBuilder().ForUser(userId).Build();
        return new UserBuilder()
            .WithId(userId)
            .WithFirstName(first)
            .WithLastName(last)
            .AsVerified()
            .WithProfile(profile)
            .Build();
    }

    private Task SeedUsers(params AFBack.Features.Auth.Models.AppUser[] users) =>
        factory.SeedAsync(async db =>
        {
            db.AppUsers.AddRange(users);
            await db.SaveChangesAsync();
        });

    private Task<List<AFBack.Features.Searching.DTOs.Responses.UserSearchResult>> RunSearch(
        Func<SearchRepository, Task<List<AFBack.Features.Searching.DTOs.Responses.UserSearchResult>>> query) =>
        factory.QueryAsync(async db => await query(new SearchRepository(db)));
}
