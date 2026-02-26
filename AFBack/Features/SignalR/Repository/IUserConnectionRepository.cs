using AFBack.Features.SignalR.Models;

namespace AFBack.Features.SignalR.Repository;

public interface IUserConnectionRepository
{
    // ============================== GET ==============================
    
    /// <summary>
    /// Henter en connection basert på userId og connectionId
    /// </summary>
    /// <param name="userId">BrukerID</param>
    /// <param name="connectionId">ID til tilkoblingen</param>
    /// <param name="ct"></param>
    /// <returns>UserConnection eller null</returns>
    Task<UserConnection?> GetByConnectionIdAsync(string userId, string connectionId, CancellationToken ct = default);

    /// <summary>
    /// Henter aktive connection IDs for en bruker
    /// </summary>
    /// <param name="userId">Brukren</param>
    /// <param name="ct"></param>
    /// <returns>Liste med connection Ids</returns>
    Task<IReadOnlyList<string>> GetActiveConnectionIdsAsync(string userId, CancellationToken ct = default);
    
    /// <summary>
    /// Henter aktive connection IDs for en bruker, ekskludert en spesifikk enhet.
    /// Brukes for å finne andre aktive enheter ved ny tilkobling.
    /// </summary>
    /// <param name="userId">Brukerne</param>
    /// <param name="excludeDeviceId">Enheten som skal ekskluderes</param>
    /// <param name="ct"></param>
    /// <returns>Liste med aktive connections IDS</returns>
    Task<List<string>> GetOtherActiveConnectionIdsAsync(string userId, int excludeDeviceId, 
        CancellationToken ct = default);

    /// <summary>
    /// Henter en aktiv connection for en bruker på en spesifikk enhet
    /// </summary>
    /// <param name="userId">Brukeren</param>
    /// <param name="userDeviceId">UserDevice</param>
    /// <param name="ct"></param>
    /// <returns>UserConnection eller null</returns>
    Task<UserConnection?> GetActiveByDeviceAsync(string userId, int userDeviceId, CancellationToken ct = default);

   

    // ============================== CREATE ==============================
    
    /// <summary>
    /// Legger til en ny connection.
    /// </summary>
    Task AddAsync(UserConnection connection, CancellationToken ct = default);

    // ============================== UPDATE ==============================
    
    /// <summary>
    /// Oppdaterer LastHeartbeat for en aktiv connection.
    /// Returnerer antall rader oppdatert
    /// </summary>
    /// <param name="userId">BrukerId</param>
    /// <param name="connectionId">Tilkoblings ID</param>
    /// <param name="ct"></param>
    /// <returns>1, eller 0 hvis connection ikke finnes/ikke er aktiv</returns>
    Task<int> UpdateHeartbeatAsync(string userId, string connectionId, CancellationToken ct = default);
    
    
    // ============================== DELETE ==============================
    /// <summary>
    /// Sletter en tracked UserConnection fra databasen.
    /// </summary>
    /// <param name="connection">ConnectionID</param>
    /// <param name="ct"></param>
    Task DeleteAsync(UserConnection connection, CancellationToken ct = default);

    /// <summary>
    /// Sletter stale connections direkte fra databasen.
    /// Connections med LastHeartbeat eldre enn cutoff som fortsatt er markert som connected.
    /// Returnerer antall slettede rader.
    /// </summary>
    /// <param name="cutoff">Grensen fra siste heartbeat</param>
    /// <param name="ct"></param>
    /// <returns>Antall connections slettet</returns>
    Task<int> DeleteStaleConnectionsAsync(DateTime cutoff, CancellationToken ct = default);
    
    
    // ============================== SAVE ==============================
    Task SaveChangesAsync(CancellationToken ct = default);
}
