namespace AFBack.Models;

/// <summary>
/// Detaljert rapport over brukeraktivitet
/// </summary>
public class UserActivityReport
{
    public int UserId { get; set; }
    public string IpAddress { get; set; } = "";
    public int TotalActivities { get; set; }
    public int HighRiskActivities { get; set; }
    public int CriticalActivities { get; set; }
    public int UniqueActivityTypes { get; set; }
    public DateTime? MostRecentActivity { get; set; }
    public bool IsSuspicious { get; set; }
    public Dictionary<string, int> ActivityBreakdown { get; set; } = new();
}