using AFBack.Common.Results;
using AFBack.Infrastructure.Email.Models;

namespace AFBack.Infrastructure.Email;

public interface IEmailService
{
    /// <summary>
    /// Sender en e-post med ferdig rendret innhold fra EmailTemplate.
    /// 1. Først bygg datamodellen fra Models-mappen som brueks for å bygge eposten
    /// 2. Kall EmailTemplates med denne datamodellen for å få ferdig EmailBody
    /// 3. Send via SendAsync email og body
    /// </summary>
    /// <param name="toEmail">Eposten som skal få meldingen</param>
    /// <param name="body">Ferdig template</param>
    /// <returns>Result med Success hvis mail send eller Failure hvis noe gikk galt</returns>
    Task<Result> SendAsync(string toEmail, EmailBody body);
}
