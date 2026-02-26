using System.Net;

namespace AFBack.Infrastructure.Email.Templates;

/// <summary>
/// Felles HTML-layout for alle e-postmaler. Header med logo, body-wrapper og footer.
/// Brukes av EmailTemplates og SupportTicketTemplates for å unngå duplisering.
/// </summary>
internal static class EmailLayout
{
    private const string LogoUrlDefault =
        "https://activitystorage.blob.core.windows.net/static/LogoMedSegoeUIHvit.png";

    /// <summary>
    /// Wrapper body-innhold i felles HTML-layout med header (logo) og footer.
    /// </summary>
    public static string Wrap(string title, string bodyContent, string footerLine1,
        string? footerLine2 = null)
    {
        var footerHtml = $"<p style='margin:0 0 8px 0;'>{footerLine1}</p>";
        if (footerLine2 is not null)
            footerHtml += $"<p style='margin:0;'>{footerLine2}</p>";

        return $@"
            <!DOCTYPE html>
            <html lang='en'>
            <head>
                <meta charset='UTF-8'>
                <meta name='viewport' content='width=device-width, initial-scale=1.0'>
                <title>{title}</title>
            </head>
            <body style='margin:0; padding:20px; font-family:Segoe UI, sans-serif;'>
                <div style='max-width:600px; margin:0 auto;'>
                    <div style='background-color:#1C6B1C; padding:30px; text-align:center; border-top-left-radius:10px; border-top-right-radius:10px;'>
                        <img src='{LogoUrlDefault}' alt='Koptr Logo' style='width:120px; margin-bottom:10px;'>
                    </div>
                    <div style='background-color:#ffffff; padding:40px 30px;'>
                        {bodyContent}
                    </div>
                    <div style='background-color:#1C6B1C; color:white; text-align:center; padding:20px; border-bottom-left-radius:10px; border-bottom-right-radius:10px; font-size:13px;'>
                        {footerHtml}
                    </div>
                </div>
            </body>
            </html>";
    }

    /// <summary>
    /// Standard support-footer med kontakt-lenke.
    /// </summary>
    public const string SupportFooter =
        "Need help? Contact <a href='mailto:support@koptr.net' style='color:#d1d5db;'>support@koptr.net</a>";

    /// <summary>
    /// HTML-encoder brukerinput for å forhindre HTML/script-injection i e-postmaler.
    /// Konverterer tegn som &lt; &gt; &amp; &quot; til trygge HTML-entiteter.
    /// </summary>
    public static string H(string? input) => WebUtility.HtmlEncode(input ?? string.Empty);

    /// <summary>
    /// URL-encoder brukerinput for trygge query-parametere i lenker.
    /// </summary>
    public static string U(string? input) => Uri.EscapeDataString(input ?? string.Empty);
}
