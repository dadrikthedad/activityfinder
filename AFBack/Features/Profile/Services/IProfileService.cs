using AFBack.Common.Results;
using AFBack.Features.Profile.DTOs.Requests;
using AFBack.Features.Profile.DTOs.Responses;

namespace AFBack.Features.Profile.Services;

public interface IProfileService
{
    /// <summary>
    /// Henter egen profil for redigering (alle felt)
    /// </summary>
    /// <param name="userId"></param>
    /// <returns>MyProfileResponse med alle felter</returns>
    Task<Result<MyProfileResponse>> GetMyProfileAsync(string userId);

    /// <summary>
    /// Henter en annen brukers offentlige profil, filtrert av deres UserSettings
    /// </summary>
    /// <param name="userId">ID-en til brukeren som henter</param>
    /// <param name="targetUserId">ID-en til brukeren som eier profilen vi skal vise</param>
    /// <returns>PublicProfileResponse med felter tillatt av settings</returns>
    Task<Result<PublicProfileResponse>> GetPublicProfileAsync(string userId,
        string targetUserId);
    
    /// <summary>
    /// Oppdaterer alle profilfelt for innlogget bruker
    /// </summary>
    /// <param name="userId">Brukerens ID</param>
    /// <param name="request">UpdateProfileRequest med alle UserProfile-egenskaper</param>
    /// <returns>Result med Success eller Failure</returns>
    Task<Result> UpdateProfileAsync(string userId, UpdateProfileRequest request);
}
