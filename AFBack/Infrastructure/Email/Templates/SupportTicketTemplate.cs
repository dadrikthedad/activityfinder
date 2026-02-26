using AFBack.Features.Support.Enums;
using AFBack.Features.Support.Models;
using AFBack.Infrastructure.Email.Models;
using static AFBack.Infrastructure.Email.Templates.EmailLayout;

namespace AFBack.Infrastructure.Email.Templates;

/// <summary>
/// Statisk klasse som rendrer e-postmaler for support tickets og user reports.
/// Bruker EmailLayout.Wrap() for felles header/footer og H()/U() for input-sanitering.
/// </summary>
public static class SupportTicketTemplates
{
    // ======================== Support Ticket templates ========================

    /// <summary>
    /// Bygger en bekreftelsesmail til brukeren etter innsendt support ticket.
    /// </summary>
    public static EmailBody SupportTicketConfirmation(SupportTicket ticket)
    {
        var title = H(ticket.Title);

        var bodyContent = $@"
            <h2 style='margin-top:0; color:#2d3748;'>Support Ticket Received</h2>
            <p style='color:#4a5568; font-size:16px; line-height:1.6;'>
                Thank you for contacting Koptr. We have received your support ticket and will respond as soon as possible.
            </p>

            <!-- Ticket Details -->
            <div style='background:#f0fdf4; padding:20px; border-radius:8px; border:2px solid #1C6B1C; margin:30px 0;'>
                <h3 style='color:#1C6B1C; margin:0 0 16px 0; font-size:18px;'>Ticket Details</h3>
                <table style='width:100%;'>
                    <tr>
                        <td style='padding:6px 0; color:#718096; font-size:14px; width:100px;'>Ticket ID:</td>
                        <td style='padding:6px 0; color:#1C6B1C; font-size:14px; font-weight:bold;'>#{ticket.Id}</td>
                    </tr>
                    <tr>
                        <td style='padding:6px 0; color:#718096; font-size:14px;'>Title:</td>
                        <td style='padding:6px 0; color:#2d3748; font-size:14px;'>{title}</td>
                    </tr>
                    <tr>
                        <td style='padding:6px 0; color:#718096; font-size:14px;'>Created:</td>
                        <td style='padding:6px 0; color:#2d3748; font-size:14px;'>{ticket.CreatedAt:yyyy-MM-dd HH:mm} UTC</td>
                    </tr>
                </table>
            </div>

            <p style='color:#4a5568; font-size:16px; line-height:1.6;'>
                We typically respond within <strong style='color:#1C6B1C;'>24-48 hours</strong>.
            </p>

            <hr style='margin:30px 0; border:none; border-top:1px solid #e2e8f0;'>

            <p style='font-size:14px; color:#718096;'>
                Best regards,<br>
                <strong>The Koptr Support Team</strong>
            </p>";

        var html = Wrap("Support Ticket Received", bodyContent,
            SupportFooter,
            $"© {DateTime.UtcNow.Year} Koptr – This is an automated message, please do not reply directly.");

        var plainText = $"Support Ticket Received\n\n" +
                        $"Thank you for contacting Koptr. We have received your support ticket.\n\n" +
                        $"Ticket ID: #{ticket.Id}\n" +
                        $"Title: {ticket.Title}\n" +
                        $"Created: {ticket.CreatedAt:yyyy-MM-dd HH:mm} UTC\n\n" +
                        $"We typically respond within 24-48 hours.\n\n" +
                        $"Best regards,\nThe Koptr Support Team";

        return new EmailBody($"Support ticket #{ticket.Id} received", html, plainText);
    }

    /// <summary>
    /// Bygger en varselsmail til support-teamet når en ny support ticket er opprettet.
    /// </summary>
    public static EmailBody SupportTicketNotification(SupportTicket ticket)
    {
        var email = H(ticket.Email);
        var title = H(ticket.Title);
        var description = H(ticket.Description);

        var bodyContent = $@"
            <h2 style='margin-top:0; color:#2d3748;'>New Support Ticket #{ticket.Id}</h2>

            <table style='width:100%; margin:20px 0;'>
                <tr>
                    <td style='padding:10px 0; border-bottom:1px solid #e2e8f0; color:#718096; font-size:14px; font-weight:600; width:120px;'>From:</td>
                    <td style='padding:10px 0; border-bottom:1px solid #e2e8f0; color:#2d3748; font-size:14px;'>{email}</td>
                </tr>
                <tr>
                    <td style='padding:10px 0; border-bottom:1px solid #e2e8f0; color:#718096; font-size:14px; font-weight:600;'>Type:</td>
                    <td style='padding:10px 0; border-bottom:1px solid #e2e8f0; color:#2d3748; font-size:14px;'>{ticket.Type}</td>
                </tr>
                <tr>
                    <td style='padding:10px 0; border-bottom:1px solid #e2e8f0; color:#718096; font-size:14px; font-weight:600;'>Created:</td>
                    <td style='padding:10px 0; border-bottom:1px solid #e2e8f0; color:#2d3748; font-size:14px;'>{ticket.CreatedAt:yyyy-MM-dd HH:mm} UTC</td>
                </tr>
                <tr>
                    <td style='padding:10px 0; border-bottom:1px solid #e2e8f0; color:#718096; font-size:14px; font-weight:600;'>Attachments:</td>
                    <td style='padding:10px 0; border-bottom:1px solid #e2e8f0; color:#2d3748; font-size:14px;'>{ticket.Attachments.Count}</td>
                </tr>
            </table>

            <!-- Title -->
            <div style='margin-top:25px;'>
                <h3 style='margin:0 0 8px; color:#2d3748; font-size:16px; font-weight:600;'>Title:</h3>
                <p style='margin:0; color:#2d3748; font-size:15px; line-height:1.5;'>{title}</p>
            </div>

            <!-- Description -->
            <div style='margin-top:25px;'>
                <h3 style='margin:0 0 8px; color:#2d3748; font-size:16px; font-weight:600;'>Description:</h3>
                <div style='background:#f0fdf4; padding:20px; border-radius:6px; border-left:4px solid #1C6B1C;'>
                    <p style='margin:0; color:#2d3748; font-size:14px; line-height:1.6; white-space:pre-wrap;'>{description}</p>
                </div>
            </div>";

        var html = Wrap("New Support Ticket", bodyContent, "Koptr Support System");

        var plainText = $"NEW SUPPORT TICKET #{ticket.Id}\n\n" +
                        $"From: {ticket.Email}\n" +
                        $"Type: {ticket.Type}\n" +
                        $"Created: {ticket.CreatedAt:yyyy-MM-dd HH:mm} UTC\n" +
                        $"Attachments: {ticket.Attachments.Count}\n\n" +
                        $"Title: {ticket.Title}\n\n" +
                        $"Description:\n{ticket.Description}";

        return new EmailBody($"[Support] New ticket #{ticket.Id}: {ticket.Title}", html, plainText);
    }

    // ======================== User Report templates ========================

    /// <summary>
    /// Bygger en varselsmail til moderator-teamet når en ny brukerrapport er opprettet.
    /// </summary>
    public static EmailBody UserReportNotification(UserReport report)
    {
        var submittedBy = H(report.SubmittedByUserId);
        var reportedUser = H(report.ReportedUserId);
        var description = H(report.Description);

        var bodyContent = $@"
            <h2 style='margin-top:0; color:#2d3748;'>New User Report #{report.Id}</h2>

            <table style='width:100%; margin:20px 0;'>
                <tr>
                    <td style='padding:10px 0; border-bottom:1px solid #e2e8f0; color:#718096; font-size:14px; font-weight:600; width:130px;'>Report ID:</td>
                    <td style='padding:10px 0; border-bottom:1px solid #e2e8f0; color:#1C6B1C; font-size:14px; font-weight:bold;'>#{report.Id}</td>
                </tr>
                <tr>
                    <td style='padding:10px 0; border-bottom:1px solid #e2e8f0; color:#718096; font-size:14px; font-weight:600;'>Reported by:</td>
                    <td style='padding:10px 0; border-bottom:1px solid #e2e8f0; color:#2d3748; font-size:14px;'>{submittedBy}</td>
                </tr>
                <tr>
                    <td style='padding:10px 0; border-bottom:1px solid #e2e8f0; color:#718096; font-size:14px; font-weight:600;'>Reported user:</td>
                    <td style='padding:10px 0; border-bottom:1px solid #e2e8f0; color:#2d3748; font-size:14px;'>{reportedUser}</td>
                </tr>
                <tr>
                    <td style='padding:10px 0; border-bottom:1px solid #e2e8f0; color:#718096; font-size:14px; font-weight:600;'>Reason:</td>
                    <td style='padding:10px 0; border-bottom:1px solid #e2e8f0; color:#2d3748; font-size:14px;'>{FormatReportReason(report.Reason)}</td>
                </tr>
                <tr>
                    <td style='padding:10px 0; border-bottom:1px solid #e2e8f0; color:#718096; font-size:14px; font-weight:600;'>Created:</td>
                    <td style='padding:10px 0; border-bottom:1px solid #e2e8f0; color:#2d3748; font-size:14px;'>{report.CreatedAt:yyyy-MM-dd HH:mm} UTC</td>
                </tr>
                <tr>
                    <td style='padding:10px 0; border-bottom:1px solid #e2e8f0; color:#718096; font-size:14px; font-weight:600;'>Attachments:</td>
                    <td style='padding:10px 0; border-bottom:1px solid #e2e8f0; color:#2d3748; font-size:14px;'>{report.Attachments.Count}</td>
                </tr>
            </table>

            <!-- Description -->
            <div style='margin-top:25px;'>
                <h3 style='margin:0 0 8px; color:#2d3748; font-size:16px; font-weight:600;'>Description:</h3>
                <div style='background:#f0fdf4; padding:20px; border-radius:6px; border-left:4px solid #1C6B1C;'>
                    <p style='margin:0; color:#2d3748; font-size:14px; line-height:1.6; white-space:pre-wrap;'>{description}</p>
                </div>
            </div>

            {(report.Reason is UserReportReason.MinorSafety or UserReportReason.Threats
                ? @"<div style='background:#fef2f2; border:2px solid #dc2626; border-radius:8px; padding:16px; margin-top:25px; text-align:center;'>
                        <p style='margin:0; color:#dc2626; font-size:16px; font-weight:bold;'>⚠️ HIGH PRIORITY — Requires immediate review</p>
                    </div>"
                : "")}";

        var html = Wrap("New User Report", bodyContent, "Koptr Moderation System");

        var plainText = $"NEW USER REPORT #{report.Id}\n\n" +
                        $"Reported by: {report.SubmittedByUserId}\n" +
                        $"Reported user: {report.ReportedUserId}\n" +
                        $"Reason: {FormatReportReason(report.Reason)}\n" +
                        $"Created: {report.CreatedAt:yyyy-MM-dd HH:mm} UTC\n" +
                        $"Attachments: {report.Attachments.Count}\n\n" +
                        $"Description:\n{report.Description}";

        return new EmailBody($"[Report] #{report.Id}: {FormatReportReason(report.Reason)}", html, plainText);
    }

    // ======================== Hjelpemetoder ========================

    /// <summary>
    /// Formaterer UserReportReason enum til lesbar tekst med mellomrom.
    /// </summary>
    private static string FormatReportReason(UserReportReason reason)
        => reason switch
        {
            UserReportReason.InappropriateContent => "Inappropriate Content",
            UserReportReason.HateSpeech => "Hate Speech",
            UserReportReason.MinorSafety => "Minor Safety",
            _ => reason.ToString()
        };
}
