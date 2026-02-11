namespace AFBack.Infrastructure.Email.Models;

/// <summary>
/// Ferdig rendret e-postinnhold klart for sending.
/// </summary>
public sealed record EmailBody(
    string Subject,
    string Html,
    string PlainText
);
