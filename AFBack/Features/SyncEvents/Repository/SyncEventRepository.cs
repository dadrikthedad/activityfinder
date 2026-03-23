using AFBack.Data;
using AFBack.Features.SyncEvents.DTOs;
using AFBack.Features.SyncEvents.Models;
using Microsoft.EntityFrameworkCore;

namespace AFBack.Features.SyncEvents.Repository;

public class SyncEventRepository(AppDbContext context) : ISyncEventRepository
{
    /// <summary>
    /// Lagrer flere SyncEvents i en liste til databasen
    /// </summary>
    /// <param name="syncEvents">Liste med SyncEvent</param>
    /// <param name="ct"></param>
    public async Task SaveSyncEventsAsync(List<SyncEvent> syncEvents, CancellationToken ct = default)
    {
        context.SyncEvents.AddRange(syncEvents);
        await context.SaveChangesAsync(ct);
    }

    public async Task<int> CountEventsSinceTimestamp(string userId, DateTime lastSyncEvent,
        CancellationToken ct = default) =>
        await context.SyncEvents
            .Where(e => e.UserId == userId && e.CreatedAt > lastSyncEvent).CountAsync(ct);

    public async Task<List<SyncEventResponse>> GetSyncEventsAsync(string userId, DateTime lastSyncEvent,
        CancellationToken ct = default) =>
        await context.SyncEvents
            .Where(e => e.UserId == userId && e.CreatedAt > lastSyncEvent)
            .OrderBy(e => e.CreatedAt)
            .Select(e => new SyncEventResponse
            {
                Id = e.Id,
                EventType = e.EventType,
                EventData = e.EventData,
                CreatedAt = e.CreatedAt
            })
            .ToListAsync(ct);

    /// <inheritdoc />
    public async Task<int> DeleteEventsOlderThanAsync(DateTime cutoff, CancellationToken ct = default) =>
        await context.SyncEvents
            .Where(e => e.CreatedAt < cutoff)
            .ExecuteDeleteAsync(ct);
}
