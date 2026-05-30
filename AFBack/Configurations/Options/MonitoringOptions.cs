namespace AFBack.Configurations.Options;

public class MonitoringOptions
{
    public const string SectionName = "Monitoring";

    public string ApplicationInsightsConnectionString { get; set; } = string.Empty;
}
