using System.Text;
using System.Text.Json;
using AFBack.Constants;
using AFBack.Data;
using AFBack.Models;
using AFBack.DTOs;
using AFBack.DTOs.BoostrapDTO.Sync;
using AFBack.Extensions;
using AFBack.Interface.Services;
using Microsoft.EntityFrameworkCore;

namespace AFBack.Services;

public class SyncService(ApplicationDbContext context, ILogger<SyncService> logger) : ISyncService
{
    /// <summary>
    /// Generer ny sync token
    /// </summary>
    public string GenerateSyncToken()
    {
        var timestamp = DateTime.UtcNow;
        var random = Random.Shared.Next(1000, 9999);
        
        var token = new SyncEventExtensions.SyncToken
        {
            Timestamp = timestamp,
            Version = 1,
            Random = random, // Inkluder random-verdien
            Hash = GenerateTokenHash(timestamp, random)
        };
        
        var json = JsonSerializer.Serialize(token);
        var bytes = Encoding.UTF8.GetBytes(json);
        return Convert.ToBase64String(bytes);
    }

    /// <summary>
    /// Validér token hash
    /// </summary>
    public bool ValidateTokenHash(SyncEventExtensions.SyncToken token)
    {
        try
        {
            // Generer forventet hash basert på token-data
            var expectedHash = GenerateTokenHash(token.Timestamp, token.Random);
            
            // Sammenlign med faktisk hash
            return string.Equals(token.Hash, expectedHash, StringComparison.Ordinal);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Failed to validate token hash");
            return false;
        }
    }

    /// <summary>
    /// Generer hash for token (for integritet/validering)
    /// </summary>
    private string GenerateTokenHash(DateTime timestamp, int random)
    {
        // Inkluder versjon i hash for fremtidig kompatibilitet
        var data = $"v1-{timestamp:O}-{random}";
        var bytes = Encoding.UTF8.GetBytes(data);
        using var sha256 = System.Security.Cryptography.SHA256.Create();
        var hash = sha256.ComputeHash(bytes);
        return Convert.ToBase64String(hash)[..12]; // Øk til 12 karakterer for bedre sikkerhet
    }

    /// <summary>
    /// Parse sync token
    /// </summary>
    public SyncEventExtensions.SyncToken? ParseSyncToken(string tokenString)
    {
        try
        {
            var bytes = Convert.FromBase64String(tokenString);
            var json = Encoding.UTF8.GetString(bytes);
            var token = JsonSerializer.Deserialize<SyncEventExtensions.SyncToken>(json);
            
            if (token == null)
            {
                logger.LogWarning("Failed to deserialize sync token");
                return null;
            }
            
            
            
            // Validér token integritet
            if (token.Version == 1)
            {
                
                // I ParseSyncToken, legg til explicit token age sjekk:
                if (DateTime.UtcNow - token.Timestamp > TimeSpan.FromDays(7))
                {
                    logger.LogInformation("Token expired: {Age:F1} days old (created: {Created})", 
                        (DateTime.UtcNow - token.Timestamp).TotalDays,
                        token.Timestamp.ToString("yyyy-MM-dd HH:mm:ss UTC"));
                    return null;
                }
                
                if (string.IsNullOrEmpty(token.Hash))
                {
                    logger.LogWarning("Sync token missing hash for version 1");
                    return null;
                }
                
                if (!ValidateTokenHash(token))
                {
                    logger.LogWarning("Sync token hash validation failed");
                    return null;
                }
            }
            
            return token;
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Failed to parse sync token: {Token}", tokenString);
            return null;
        }
    }

    /// <summary>
    /// Lag en sync event
    /// </summary>
    public async Task<string> CreateSyncEventAsync(int userId, string eventType, object eventData, string? source = null, int? relatedEntityId = null, string? relatedEntityType = null)
    {
        try
        {
            var syncToken = GenerateSyncToken();
            
            var syncEvent = new SyncEvent
            {
                UserId = userId,
                EventType = eventType,
                EventData = JsonSerializer.Serialize(eventData),
                SyncToken = syncToken,
                Source = source,
                RelatedEntityId = relatedEntityId,
                RelatedEntityType = relatedEntityType,
                CreatedAt = DateTime.UtcNow
            };

            context.SyncEvents.Add(syncEvent);
            await context.SaveChangesAsync();
            
            logger.LogDebug("Created sync event {EventType} for user {UserId}", eventType, userId);
            return syncToken;
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to create sync event for user {UserId}", userId);
            throw;
        }
    }
    
    /// <summary>
    /// Lag sync events for flere brukere samtidig (f.eks. gruppe meldinger)
    /// </summary>
    public async Task<string> CreateSyncEventsForMultipleUsersAsync(
        IEnumerable<int> userIds, 
        string eventType, 
        object eventData, 
        string? source = null, 
        int? relatedEntityId = null, 
        string? relatedEntityType = null)
    {
        try
        {
            var syncToken = GenerateSyncToken();
            var eventDataJson = JsonSerializer.Serialize(eventData);
            var createdAt = DateTime.UtcNow;

            var syncEvents = userIds.Select(userId => new SyncEvent
            {
                UserId = userId,
                EventType = eventType,
                EventData = eventDataJson,
                SyncToken = syncToken,
                Source = source,
                RelatedEntityId = relatedEntityId,
                RelatedEntityType = relatedEntityType,
                CreatedAt = createdAt
            }).ToList();

            context.SyncEvents.AddRange(syncEvents);
            await context.SaveChangesAsync();
        
            logger.LogDebug("Created {Count} sync events of type {EventType}", 
                syncEvents.Count, eventType);
            return syncToken;
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to create sync events for multiple users");
            throw;
        }
    }

    /// <summary>
    /// Hent events siden siste sync
    /// </summary>
    public async Task<SyncResponseDTO> GetEventsSinceAsync(int userId, string? sinceSyncToken)
    {
        try
        {
            DateTime? sinceTimestamp = null;
            
            if (!string.IsNullOrEmpty(sinceSyncToken))
            {
                var parsedToken = ParseSyncToken(sinceSyncToken);
                if (parsedToken != null)
                {
                    sinceTimestamp = parsedToken.Timestamp;
                    
                    // Sjekk om token er for gammelt (mer enn 7 dager)
                    if (DateTime.UtcNow - sinceTimestamp > TimeSpan.FromDays(7))
                    {
                        logger.LogInformation("Sync token too old for user {UserId}, requiring full refresh", userId);
                        return new SyncResponseDTO 
                        { 
                            RequiresFullRefresh = true,
                            NewSyncToken = GenerateSyncToken(),
                            Message = "Sync token expired, full refresh required"
                        };
                    }
                }
                else
                {
                    logger.LogWarning("Invalid sync token for user {UserId}", userId);
                    return new SyncResponseDTO 
                    { 
                        RequiresFullRefresh = true,
                        NewSyncToken = GenerateSyncToken(),
                        Message = "Invalid sync token, full refresh required"
                    };
                }
            }

            // Bygg query step-by-step
            var query = context.SyncEvents
                .Where(e => e.UserId == userId);

            if (sinceTimestamp.HasValue)
            {
                query = query.Where(e => e.CreatedAt > sinceTimestamp.Value);
            }

            var events = await query
                .OrderBy(e => e.CreatedAt)
                .Take(1000)
                .Select(e => new SyncEventDto
                {
                    Id = e.Id,
                    EventType = e.EventType,
                    EventData = ReserializeEventData(e.EventData), // Pass eventType
                    CreatedAt = e.CreatedAt,
                    Source = e.Source,
                    RelatedEntityId = e.RelatedEntityId,
                    RelatedEntityType = e.RelatedEntityType
                })
                .ToListAsync();

            var newSyncToken = GenerateSyncToken();
            
            logger.LogInformation("Retrieved {Count} sync events for user {UserId} since {Since}", 
                events.Count, userId, sinceTimestamp?.ToString() ?? "beginning");

            return new SyncResponseDTO
            {
                Events = events,
                NewSyncToken = newSyncToken,
                RequiresFullRefresh = false,
                Message = $"Retrieved {events.Count} events"
            };
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to get sync events for user {UserId}", userId);
            throw;
        }
    }
    
    public string ReserializeEventData(string eventData)
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
    
    // TODO: Må denne inn i cleanupManager/servicen?
    public async Task CleanupOldEventsAsync()
    {
        try
        {
            var cutoffDate = DateTime.UtcNow.AddDays(-30);
        
            var oldEventsCount = await context.SyncEvents
                .Where(e => e.CreatedAt < cutoffDate)
                .ExecuteDeleteAsync();

            logger.LogInformation("Cleaned up {Count} old sync events", oldEventsCount);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to cleanup old sync events");
            throw; // Re-throw så MaintenanceCleanupService kan håndtere retry
        }
    }
    
    /// <summary>
    /// Universal metode for å opprette sync events - kan brukes overalt
    /// </summary>
    public async Task CreateAndDistributeSyncEventAsync(
        string eventType,
        object eventData,
        IEnumerable<int>? targetUserIds = null,  // Hvis null, bruk singleUserId
        int? singleUserId = null,                // For single user events
        string? source = null,
        int? relatedEntityId = null,
        string? relatedEntityType = null)
    {
        try
        {
            // Bestem hvilke brukere som skal få eventet
            List<int> userIds;
            
            if (targetUserIds != null)
            {
                userIds = targetUserIds.ToList();
            }
            else if (singleUserId.HasValue)
            {
                userIds = new List<int> { singleUserId.Value };
            }
            else
            {
                throw new ArgumentException("Either targetUserIds or singleUserId must be provided");
            }

            if (!userIds.Any())
            {
                logger.LogWarning("No target users provided for sync event {EventType}", eventType);
                return;
            }

            // Opprett events
            if (userIds.Count == 1)
            {
                await CreateSyncEventAsync(
                    userId: userIds.First(),
                    eventType: eventType,
                    eventData: eventData,
                    source: source,
                    relatedEntityId: relatedEntityId,
                    relatedEntityType: relatedEntityType
                );
            }
            else
            {
                await CreateSyncEventsForMultipleUsersAsync(
                    userIds: userIds,
                    eventType: eventType,
                    eventData: eventData,
                    source: source,
                    relatedEntityId: relatedEntityId,
                    relatedEntityType: relatedEntityType
                );
            }

            logger.LogDebug("Created sync event {EventType} for {UserCount} users", 
                eventType, userIds.Count);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to create and distribute sync event {EventType}", eventType);
            throw;
        }
    }
}