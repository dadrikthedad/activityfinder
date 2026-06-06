using AFBack.Features.Support.Enums;
using AFBack.Features.Support.Models;
using AFBack.Features.Support.Repositories;
using AFBack.Tests.Builders;
using AFBack.Tests.Common;
using FluentAssertions;

namespace AFBack.Tests.Features.Support;

[Collection(nameof(IntegrationTestsCollection))]
public class SupportRepositoryTests(BackendApplicationFactory factory) : IAsyncLifetime
{
    public Task InitializeAsync() => Task.CompletedTask;

    public async Task DisposeAsync() => await factory.ResetDatabaseAsync();

    // ======================== HasPendingReportAsync ========================

    [Fact]
    public async Task HasPendingReportAsync_WhenPendingReportExists_ShouldReturnTrue()
    {
        // Arrange
        var reporter  = new UserBuilder().AsVerified().Build();
        var reported  = new UserBuilder().AsVerified().Build();

        await factory.SeedAsync(async db =>
        {
            db.AppUsers.AddRange(reporter, reported);
            await db.SaveChangesAsync();

            db.UserReports.Add(Report(reporter.Id, reported.Id, UserReportStatus.Pending));
            await db.SaveChangesAsync();
        });

        // Act
        var result = await RunQuery(r => r.HasPendingReportAsync(reporter.Id, reported.Id));

        // Assert
        result.Should().BeTrue();
    }

    [Fact]
    public async Task HasPendingReportAsync_WhenReportIsNotPending_ShouldReturnFalse()
    {
        // Arrange
        var reporter = new UserBuilder().AsVerified().Build();
        var reported = new UserBuilder().AsVerified().Build();

        await factory.SeedAsync(async db =>
        {
            db.AppUsers.AddRange(reporter, reported);
            await db.SaveChangesAsync();

            db.UserReports.Add(Report(reporter.Id, reported.Id, UserReportStatus.Dismissed));
            await db.SaveChangesAsync();
        });

        // Act
        var result = await RunQuery(r => r.HasPendingReportAsync(reporter.Id, reported.Id));

        // Assert
        result.Should().BeFalse();
    }

    // ======================== Hjelpemetoder ========================

    private static UserReport Report(string submittedBy, string reportedUser, UserReportStatus status) =>
        new()
        {
            SubmittedByUserId = submittedBy,
            ReportedUserId    = reportedUser,
            Status            = status,
            Reason            = UserReportReason.Spam
        };

    private Task<T> RunQuery<T>(Func<SupportRepository, Task<T>> query) =>
        factory.QueryAsync(async db => await query(new SupportRepository(db)));
}
