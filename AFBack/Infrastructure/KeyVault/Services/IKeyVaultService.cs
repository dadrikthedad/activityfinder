using AFBack.Common.Results;

namespace AFBack.Infrastructure.KeyVault.Services;

public interface IKeyVaultService
{
    /// <summary>
    /// Laster opp en Recovery Seed for en bruker. Brukes hvis en bruker har gjort noe alvorlig galt
    /// og vi må finne ut av meldingene av rettslige grunner
    /// </summary>
    /// <param name="userId">BrukerId</param>
    /// <param name="deviceId">DeviceID-en til brukerne</param>
    /// <param name="key">Nøkkelen som blir lagret</param>
    Task<Result> StoreRecoverySeedAsync(string userId, int deviceId, string key);
}
