using AFBack.Infrastructure.Constants;
using Microsoft.ApplicationInsights.Channel;
using Microsoft.ApplicationInsights.DataContracts;
using Microsoft.ApplicationInsights.Extensibility;
namespace AFBack.Infrastructure.Filters;

/// <summary>
/// Dette filtre sjekker params og maskerer de slik at det ikke lagres i AppInsight. Bevarer personvern
/// </summary>
public class SensitiveDataLoggingFilter : ITelemetryInitializer
{

    /// <summary>
    /// Sjekker hver URl om den må maskeres
    /// </summary>
    /// <param name="telemetry"></param>
    public void Initialize(ITelemetry telemetry)
    {
        if (telemetry is RequestTelemetry requestTelemetry)
        {
            if (requestTelemetry.Url != null)
                requestTelemetry.Url = SanitizeUrl(requestTelemetry.Url);
        }
    }
    
    /// <summary>
    /// Her maskerer vi stringen hvis det trengs
    /// </summary>
    /// <param name="url"></param>
    /// <returns></returns>
    private Uri SanitizeUrl(Uri url)
    {
        if (string.IsNullOrEmpty(url.Query))
            return url;

        var queryParams = System.Web.HttpUtility.ParseQueryString(url.Query);
        var sanitized = System.Web.HttpUtility.ParseQueryString(string.Empty);

        foreach (string key in queryParams.Keys)
        {
            if (key == null)
                continue;
            if (key.Equals("email", StringComparison.OrdinalIgnoreCase))
                sanitized[key] = MaskEmail(queryParams[key]);
            else if (SensitiveDataConstants.IsSensitive(key))
                sanitized[key] = "***REDACTED***";
            else
                sanitized[key] = queryParams[key];
        }

        var builder = new UriBuilder(url)
        {
            Query = sanitized.ToString()
        };

        return builder.Uri;
    }
    
    /// <summary>
    /// Metoden deler opp en epost i to og maskerer den, men viser oss de to første bokstavene
    /// </summary>
    /// <param name="email"></param>
    /// <returns></returns>
    private string MaskEmail(string? email)
    {
        if (string.IsNullOrEmpty(email) || !email.Contains("@"))
            return "***@***";

        var parts = email.Split('@');
        var username = parts[0];
        var domain = parts[1];

        var maskedUsername = username.Length > 2
            ? $"{username.Substring(0, 2)}***"
            : "***";

        return $"{maskedUsername}@{domain}";
    }
}
