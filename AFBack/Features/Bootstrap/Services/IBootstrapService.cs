using AFBack.Common.Results;
using AFBack.Features.Bootstrap.DTOs.Responses;

namespace AFBack.Features.Bootstrap.Services;

public interface IBootstrapService
{
    /// <summary>
    /// Kritisk bootstrap — hentes først ved app-oppstart.
    /// Inneholder brukerdata, profil og innstillinger.
    /// </summary>
    /// <param name="userId">BrukerId</param>
    /// <returns>CriticalBootstrapResponse ned data fra User, Profile og Settings</returns>
    Task<Result<CriticalBootstrapResponse>> GetCriticalBootstrapAsync(string userId);
}
