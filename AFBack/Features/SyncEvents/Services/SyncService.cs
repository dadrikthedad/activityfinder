using System.Text.Json;
using AFBack.Common.Enum;
using AFBack.Common.Results;
using AFBack.Features.SyncEvents.DTOs;
using AFBack.Configurations.Options;
using AFBack.Features.SyncEvents.Enums;
using AFBack.Features.SyncEvents.Models;
using AFBack.Features.SyncEvents.Repository;

namespace AFBack.Features.SyncEvents.Services;

public class SyncService(
    ISyncEventRepository syncEventRepository,
    IDeviceSyncStateRepository deviceSyncStateRepository, 
        ILogger<SyncService> logger) : ISyncService
{
    
    private readonly TimeSpan _inactivityThreshold = SyncEventConfig.InactivityThreshold;
    private readonly int _maxEventTreshold = SyncEventConfig.MaxEventThreshold;
    
    
    /// <inheritdoc />
    public async Task CreateSyncEventsAsync(List<string> targetUserIds, SyncEventType eventType, object eventData,
        CancellationToken ct = default)
    {
        if (targetUserIds.Count == 0)
        {
            logger.LogWarning("No users to create SyncEvent for type {EventType}", eventType);
            return;
        }

        try
        {
            var eventDataJson = JsonSerializer.Serialize(eventData);

            var syncEvents = targetUserIds.Select(userId => new SyncEvent
            {
                UserId = userId,
                EventType = eventType,
                EventData = eventDataJson
            }).ToList();

            await syncEventRepository.SaveSyncEventsAsync(syncEvents, ct);
    
            logger.LogDebug("Created {Count} sync events of type {EventType}", 
                syncEvents.Count, eventType);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to create SyncEvent '{EventType}' for {Count} users", 
                eventType, targetUserIds.Count);
        }
    }
    
    /// <inheritdoc />
    public async Task<Result<SyncResponse>> ValidateSyncForDeviceAsync(string userId, int userDeviceId,
        CancellationToken ct = default)
    {
        // ======================== STEG 1: Hent/opprett device sync state ========================
        // Sjekker om det er et eksisterende på denne enheten
        var syncState = await deviceSyncStateRepository.GetDeviceSyncStateAsync(userDeviceId, ct);
        
        // Ny enhet - vi oppretter ny syncstate
        if (syncState == null)
        {
            var newSyncState = new DeviceSyncState
            {
                UserDeviceId = userDeviceId,
                LastSyncAt = DateTime.UtcNow,
            };
            
            await deviceSyncStateRepository.CreateSyncStateAsync(newSyncState, ct);
            syncState = newSyncState;
        }
        
        logger.LogInformation(
            "Sync request for user {UserId}, device {DeviceId}, last sync: {LastSync}",
            userId, userDeviceId, syncState.LastSyncAt);
        
        // ================= STEG 2: Sjekk om enheten skal hente nye events eller full refresh =================
        // Oppdaterer nå DeviceSyncEventen med oppdaterte felter
        if (syncState.RequiresFullRefresh(_inactivityThreshold))
        {
            logger.LogInformation(
                "Device {DeviceId} inactive for {Days:F1} days - requiring full refresh",
                userDeviceId, syncState.TimeSinceLastSync.TotalDays);
            
            await UpdateAndSaveDeviceState(syncState, null, ct);
            return Result<SyncResponse>.Success(new SyncResponse { RequiresFullRefresh = true });
        }

        // ================= STEG 3: Teller antall events siden forrige event som ble synket =================
        
        // Henter ut antall eventer siden sist
        var lastSyncedEventTimestamp = syncState.LastSyncedEventTime ?? DateTime.MinValue;
        
        var numberOfEvents = await syncEventRepository.CountEventsSinceTimestamp(userId, lastSyncedEventTimestamp, 
            ct);
        
        // ================= STEG 4: Ingen events å hente. Endrer ikke på LastSyncedEventTime =================
        if (numberOfEvents == 0)
        {
            logger.LogDebug("No new events for device {DeviceId}", userDeviceId);
            
            await UpdateAndSaveDeviceState(syncState, syncState.LastSyncedEventTime, ct);
            return Result<SyncResponse>.Success(new SyncResponse { RequiresFullRefresh = false });
        }
        
        // ================= STEG 5: For mange events, full bootstrap =================
        if (numberOfEvents > _maxEventTreshold)
        {
            logger.LogInformation(
                "Too many events, {NumberOfEvents}, for device {DeviceId} - requiring full refresh",
                numberOfEvents, userDeviceId);
            
            await UpdateAndSaveDeviceState(syncState, null, ct);
            return Result<SyncResponse>.Success(new SyncResponse { RequiresFullRefresh = true });
        }
        
        // ================= STEG 6: Hent events =================
        var syncEventResponses = await GetSyncEventResponses(userId, syncState, 
            lastSyncedEventTimestamp, ct);
        
        if (syncEventResponses.Count == 0)
        {
            logger.LogCritical("GetSyncEventsAsync fetches 0 events even tho CountEventsSinceTimestamp counted " +
                               "{NumberOfEvents} events", numberOfEvents);
            return Result<SyncResponse>.Failure("Unable to fetch sync events", AppErrorCode.InternalServerError);
        }
        
        return Result<SyncResponse>.Success(new SyncResponse { Events = syncEventResponses });
    }

    /// <summary>
    /// Henter SyncEventResponses deretter reserialiserer og oppdaterer en SyncState
    /// </summary>
    /// <param name="userId">Brukeren vi skal hente SyncEvents for</param>
    /// <param name="syncState">DeviceSyncState som skal bli oppdatert</param>
    /// <param name="lastSyncedEventTimestamp">DateTime med siste SyncEvent</param>
    /// <param name="ct"></param>
    /// <returns></returns>
    private async Task<List<SyncEventResponse>> GetSyncEventResponses(string userId, DeviceSyncState syncState,
        DateTime lastSyncedEventTimestamp, CancellationToken ct = default)
    {   
        var syncEventDtos = await syncEventRepository.GetSyncEventsAsync(userId, 
            lastSyncedEventTimestamp, ct);
        
        // Deserialiserer fra JSON til objekter igjen
        foreach (var syncEventDto in syncEventDtos)
        {
            syncEventDto.EventData = ReserializeEventData(syncEventDto.EventData);
        }
        
        // Oppdaterer DeviceSyncState
        await UpdateAndSaveDeviceState(syncState, syncEventDtos.Max(e => e.CreatedAt), ct);

        return syncEventDtos;
    }

    /// <summary>
    /// Oppdaterer og lagrer et DeviceSyncState
    /// </summary>
    /// <param name="syncState">DeviceSyncState</param>
    /// <param name="lastSyncedEventTime">Hvis suksessful SyncEvent så oppdateres LastSyncedEventTime</param>
    /// <param name="ct"></param>
    private async Task UpdateAndSaveDeviceState(DeviceSyncState syncState, DateTime? lastSyncedEventTime,
        CancellationToken ct = default)
    {
        syncState.LastSyncAt = DateTime.UtcNow;
        syncState.LastSyncedEventTime = lastSyncedEventTime;
        
        await deviceSyncStateRepository.SaveChangesAsync(ct);
    }
    
    private string ReserializeEventData(string eventData)
    {
        if (string.IsNullOrEmpty(eventData))
            return eventData;
    
        try
        {
            using var document = JsonDocument.Parse(eventData);
            return JsonSerializer.Serialize(document.RootElement, new JsonSerializerOptions
            {
                PropertyNamingPolicy = JsonNamingPolicy.CamelCase
            });
        }
        catch
        {
            return eventData;
        }
    }
    
    /// <inheritdoc />
    public async Task CleanupOldEventsAsync(CancellationToken ct = default)
    {
        var cutoffDate = DateTime.UtcNow.Subtract(SyncEventConfig.InactivityThreshold);

        var deletedCount = await syncEventRepository.DeleteEventsOlderThanAsync(cutoffDate, ct);

        if (deletedCount > 0)
            logger.LogInformation("Cleaned up {Count} old sync events", deletedCount);
    }
}
