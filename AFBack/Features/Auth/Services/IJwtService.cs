namespace AFBack.Features.Auth.Services;

public interface IJwtService
{   
    /// <summary>
    /// Lager en JwtToken til en bruker som logger inn.
    /// </summary>
    /// <param name="userId">BrukerId er svært ofte med i claims</param>
    /// <param name="email">Hvis vi trenger å ha epost i claims</param>
    /// <param name="roles">Hvis vi har opprettet roller</param>
    /// <returns>Ferdig token som en string</returns>
    string GenerateJwtToken(string userId, string email, IEnumerable<string>? roles);
}

