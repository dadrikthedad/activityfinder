using AFBack.Common.Results;
using AFBack.Features.Support.DTOs.Requests;
using AFBack.Features.Support.DTOs.Responses;

namespace AFBack.Features.Support.Services;

public interface IUserReportService
{
    /// <summary>
    /// Oppretter en UserReport en bruker skriver om en annen bruker.
    /// Dropdown med reason, tekstfelt og mulighet til å sende bilder.
    /// Maks antall reports for en bruker pr dag, og bruker kan ikke rapportere samme bruker når det er en allerede
    /// ubehandlet forespørsel på en bruker.
    /// Validerer attachmetns og laster det opp til Private Container.
    /// </summary>
    /// <param name="submittedByUserId">Brukeren som rapportert</param>
    /// <param name="request">UserReportRequest</param>
    /// <param name="attachments">Attachments som en liste med IFormFile - optional</param>
    /// <param name="ct"></param>
    /// <returns>UserReportResponse med antall attachments og ID på rapporteringen</returns>
    Task<Result<UserReportResponse>> CreateUserReportAsync(string submittedByUserId, UserReportRequest request,
        List<IFormFile>? attachments, CancellationToken ct = default);
}
