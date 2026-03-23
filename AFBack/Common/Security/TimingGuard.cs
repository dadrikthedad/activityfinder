using System.Diagnostics;

namespace AFBack.Common.Security;

/// <summary>
/// Klasse som styrer TimingGuard og StopWatch - Kan brukes til å sikre at metoder bruker en minimumstid, eller
/// utføre testing på tid
/// </summary>
public static class TimingGuard
{

    /// <summary>
    /// Sikrer at en metode bruker en minimum tid som vi definerer i metoden som kaller denne
    /// </summary>
    /// <param name="sw">StopWatch-objekt som tar tiden</param>
    /// <param name="minimumMs">Minimum Milliseconds metoden skal delayes</param>
    public static async Task EnforceMinimumTimeAsync(Stopwatch sw, int minimumMs)
    {
        sw.Stop();
        var minTime = TimeSpan.FromMilliseconds(minimumMs);
        if (sw.Elapsed < minTime)
            await Task.Delay(minTime - sw.Elapsed, CancellationToken.None);
    }
}
