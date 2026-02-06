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
    public async Task SaveSyncEventsAsync(List<SyncEvent> syncEvents)
    {
        context.SyncEvents.AddRange(syncEvents);
        await context.SaveChangesAsync();
    }

    public async Task<int> CountEventsSinceTimestamp(string userId, DateTime lastSyncEvent) =>
        await context.SyncEvents
            .Where(e => e.UserId == userId && e.CreatedAt > lastSyncEvent).CountAsync();

    public async Task<List<SyncEventResponse>> GetSyncEventsAsync(string userId, DateTime lastSyncEvent) =>
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
            .ToListAsync();
}
