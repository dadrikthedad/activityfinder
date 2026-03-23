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

    
    /// <summary>
    /// Sekundær bootstrap — hentes etter kritisk data er lastet.
    /// Inneholder aktive og ventende samtaler med meldinger (meldinger hentes for alle aktive
    /// og pending 1v1-samtaler) og meldingsvarsler 
    /// </summary>
    /// <param name="userId"></param>
    /// <returns>SecondaryBootstrapResponse med tilhørende egenskaper</returns>
    Task<Result<SecondaryBootstrapResponse>> GetSecondaryBootstrapAsync(string userId);
}
