using AFBack.Infrastructure.Security.Enums;

namespace AFBack.Infrastructure.Security.Services;

public interface ISuspiciousActivityService
{
    /// <summary>
    /// Rapporterer mistenkelig aktivitet og banner IP-en automatisk hvis terskelen nås.
    /// </summary>
    /// <param name="ipAddress">IPAdressen til forespørselen</param>
    /// <param name="activityType">Type handlingen utført. F.eks. RateLimiting, spamming</param>
    /// <param name="reason">Mer detaljer om årsaken</param>
    /// <param name="userId">BrukerId hvis forespørselen var autorisert</param>
    /// <param name="userAgent">Hvis det var en nettleser</param>
    /// <param name="endpoint">Endepunktet brukt</param>
    /// <param name="deviceFingerprint">Device fingerprint</param>
    Task ReportSuspiciousActivityAsync(
        string ipAddress,
        SuspiciousActivityType activityType,
        string reason,
        string? deviceFingerprint = null,
        string? userId = null,
        string? userAgent = null,
        string? endpoint = null
    );
}
