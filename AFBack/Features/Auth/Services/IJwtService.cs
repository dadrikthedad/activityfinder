namespace AFBack.Features.Auth.Services;

public interface IJwtService
{
    /// <summary>
    /// Lager en JwtToken til en bruker som logger inn
    /// </summary>
    /// <param name="userId">BrukerId</param>
    /// <param name="email">Brukerens epost</param>
    /// <param name="roles">Hvis vi har opprettet roller</param>
    /// <param name="deviceId">DeviceId til enheten til brukeren</param>
    /// <returns>Ferdig token som en string</returns>
    string GenerateJwtToken(string userId, string email, IEnumerable<string>? roles, int deviceId);
}

