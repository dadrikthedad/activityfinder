using AFBack.Common.Results;
using AFBack.Features.Settings.DTOs.Requests;
using AFBack.Features.Settings.DTOs.Responses;

namespace AFBack.Features.Settings.Services;

public interface ISettingsService
{
    /// <summary>
    /// Henter innlogget brukers innstillinger
    /// </summary>
    /// <param name="userId">Innlogget brukers ID</param>
    /// <returns>SettingsResponse med relevante felter</returns>
    Task<Result<SettingsResponse>> GetSettingsAsync(string userId);

    /// <summary>
    /// Oppdaterer alle innstillinger for innlogget bruker
    /// </summary>
    /// <param name="userId">Innlogget brukers ID</param>
    /// <param name="request">UpdateSettingsRequest med alle felter</param>
    /// <returns>Result med Success eller Failure</returns>
    Task<Result> UpdateSettingsAsync(string userId, UpdateSettingsRequest request);
}
