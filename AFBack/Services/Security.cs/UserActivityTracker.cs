using System.Collections.Concurrent;
using AFBack.Models;

namespace AFBack.Services;

/// <summary>
/// Tracker for brukeraktivitet i minnet for rask tilgang
/// </summary>
public class UserActivityTracker
{
    private readonly ConcurrentQueue<ActivityEntry> _activities = new();
    private readonly int _userId;
    private readonly string _ipAddress;
    private readonly object _lockObject = new();
    private DateTime _lastCleanup = DateTime.UtcNow;
    
    // Konfigurasjon
    private static readonly TimeSpan ActivityWindow = TimeSpan.FromHours(1);
    private static readonly TimeSpan CleanupInterval = TimeSpan.FromMinutes(10);
    private static readonly int MaxActivitiesStored = 100;

    public UserActivityTracker(int userId, string ipAddress)
    {
        _userId = userId;
        _ipAddress = ipAddress;
    }

    /// <summary>
    /// Legger til ny aktivitet
    /// </summary>
    public void AddActivity(string activityType)
    {
        var entry = new ActivityEntry
        {
            ActivityType = activityType,
            Timestamp = DateTime.UtcNow,
            Severity = GetActivitySeverity(activityType)
        };

        _activities.Enqueue(entry);

        // Cleanup hvis nødvendig
        if (DateTime.UtcNow - _lastCleanup > CleanupInterval)
        {
            CleanupOldActivities();
        }
    }

    /// <summary>
    /// Sjekker om brukerens aktivitet er mistenkelig
    /// </summary>
    public bool IsSuspicious()
    {
        CleanupOldActivities();
        
        var recentActivities = GetRecentActivities();
        var totalCount = recentActivities.Count;
        
        if (totalCount == 0) return false;

        // Analyser forskjellige mønstre
        var suspiciousPatterns = new[]
        {
            // Mønster 1: For mange totale aktiviteter
            totalCount > 15,
            
            // Mønster 2: For mange høy-risiko aktiviteter  
            CountHighRiskActivities(recentActivities) > 3,
            
            // Mønster 3: Rask burst av aktiviteter
            HasRapidBurst(recentActivities),
            
            // Mønster 4: Flere kritiske aktiviteter
            CountCriticalActivities(recentActivities) > 1,
            
            // Mønster 5: Varierende aktivitetstyper (kan indikere bot)
            HasDiverseActivityPattern(recentActivities) && totalCount > 8
        };

        return suspiciousPatterns.Any(pattern => pattern);
    }

    /// <summary>
    /// Henter detaljert aktivitetsrapport
    /// </summary>
    public UserActivityReport GetActivityReport()
    {
        CleanupOldActivities();
        var recentActivities = GetRecentActivities();
        
        return new UserActivityReport
        {
            UserId = _userId,
            IpAddress = _ipAddress,
            TotalActivities = recentActivities.Count,
            HighRiskActivities = CountHighRiskActivities(recentActivities),
            CriticalActivities = CountCriticalActivities(recentActivities),
            UniqueActivityTypes = recentActivities.Select(a => a.ActivityType).Distinct().Count(),
            MostRecentActivity = recentActivities.LastOrDefault()?.Timestamp,
            IsSuspicious = IsSuspicious(),
            ActivityBreakdown = recentActivities
                .GroupBy(a => a.ActivityType)
                .ToDictionary(g => g.Key, g => g.Count())
        };
    }

    /// <summary>
    /// Rensker gamle aktiviteter
    /// </summary>
    public void CleanupOldActivities()
    {
        lock (_lockObject)
        {
            var cutoff = DateTime.UtcNow - ActivityWindow;
            var activitiesToKeep = new List<ActivityEntry>();
            var processedCount = 0;

            // Ta ut alle aktiviteter og behold kun relevante
            while (_activities.TryDequeue(out var activity) && processedCount < MaxActivitiesStored)
            {
                if (activity.Timestamp > cutoff)
                {
                    activitiesToKeep.Add(activity);
                }
                processedCount++;
            }

            // Legg tilbake relevante aktiviteter
            foreach (var activity in activitiesToKeep)
            {
                _activities.Enqueue(activity);
            }

            _lastCleanup = DateTime.UtcNow;
        }
    }

    #region Private Methods

    private List<ActivityEntry> GetRecentActivities()
    {
        var cutoff = DateTime.UtcNow - ActivityWindow;
        return _activities.Where(a => a.Timestamp > cutoff).ToList();
    }

    private int CountHighRiskActivities(List<ActivityEntry> activities)
    {
        return activities.Count(a => 
            a.ActivityType == "BRUTE_FORCE_ATTEMPT" ||
            a.ActivityType == "API_ABUSE" ||
            a.ActivityType == "EXCESSIVE_PASSWORD_RESET" ||
            a.Severity >= ActivitySeverity.High);
    }

    private int CountCriticalActivities(List<ActivityEntry> activities)
    {
        return activities.Count(a => a.Severity == ActivitySeverity.Critical);
    }

    private bool HasRapidBurst(List<ActivityEntry> activities)
    {
        if (activities.Count < 5) return false;

        // Sjekk om det er 5+ aktiviteter innen 2 minutter
        var sortedActivities = activities.OrderBy(a => a.Timestamp).ToList();
        
        for (int i = 0; i <= sortedActivities.Count - 5; i++)
        {
            var timeSpan = sortedActivities[i + 4].Timestamp - sortedActivities[i].Timestamp;
            if (timeSpan <= TimeSpan.FromMinutes(2))
            {
                return true;
            }
        }
        
        return false;
    }

    private bool HasDiverseActivityPattern(List<ActivityEntry> activities)
    {
        var uniqueTypes = activities.Select(a => a.ActivityType).Distinct().Count();
        return uniqueTypes >= 4; // 4+ forskjellige aktivitetstyper kan indikere bot
    }

    private ActivitySeverity GetActivitySeverity(string activityType)
    {
        return activityType switch
        {
            "RATE_LIMIT_EXCEEDED" => ActivitySeverity.Low,
            "FAILED_LOGIN" => ActivitySeverity.Medium,
            "UNVERIFIED_LOGIN_ATTEMPT" => ActivitySeverity.Medium,
            "REGISTRATION_VALIDATION_FAILED" => ActivitySeverity.Medium,
            "DUPLICATE_EMAIL_REGISTRATION" => ActivitySeverity.High,
            "BRUTE_FORCE_ATTEMPT" => ActivitySeverity.High,
            "API_ABUSE" => ActivitySeverity.High,
            "EXCESSIVE_PASSWORD_RESET" => ActivitySeverity.High,
            "VERIFICATION_EMAIL_FAILED" => ActivitySeverity.Medium,
            _ => ActivitySeverity.Medium
        };
    }

    #endregion
}

/// <summary>
/// Enkelt aktivitetsloggelement
/// </summary>
public class ActivityEntry
{
    public string ActivityType { get; set; } = "";
    public DateTime Timestamp { get; set; }
    public ActivitySeverity Severity { get; set; }
}

/// <summary>
/// Severity-nivåer for aktiviteter
/// </summary>
public enum ActivitySeverity
{
    Low = 1,
    Medium = 2,
    High = 3,
    Critical = 4
}

