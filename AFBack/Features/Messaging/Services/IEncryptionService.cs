using AFBack.Common.Results;
using AFBack.Features.Messaging.DTOs.Response;

namespace AFBack.Features.Messaging.Services;

public interface IEncryptionService
{
    /// <summary>
    /// Lagrer en UserPublicKey som er knyttet mot brukerens Private Key for kryptering. Invaldierer forrige
    /// Key
    /// </summary>
    /// <param name="userId">Brukeren</param>
    /// <param name="publicKey">Ny PublicKey</param>
    /// <param name="recoverySeed">Seed for å lagre backup phrasen</param>
    /// <param name="ct"></param>
    /// <returns>StoreUserPublicKeyResponse med versjonsnr</returns>
    Task<Result<StoreUserPublicKeyResponse>> StoreEncryptionKeysAsync(string userId, string publicKey,
        string recoverySeed, CancellationToken ct = default);

    /// <summary>
    /// Henter PublicKeys for alle deltakerne i en samtale. Valdierer at brukeren er med i samtalen.
    /// </summary>
    /// <param name="userId">Brukeren som henter</param>
    /// <param name="conversationId">Samtalen vi skal hente</param>
    /// <param name="ct"></param>
    /// <returns>ConversationKeysResponse med UserId, PublicKey og KeyVerison pr bruker</returns>
    Task<Result<ConversationKeysResponse>> GetConversationKeysAsync(string userId, int conversationId,
        CancellationToken ct = default);

    /// <summary>
    /// Henter PublicKeys for en liste med brukere. Brukes ved opprettelse av nye samtaler
    /// der conversationId ikke eksisterer ennå.
    /// </summary>
    /// <param name="userIds">Brukere som skal opprettes i samtalen</param>
    /// <param name="ct"></param>
    /// <returns>Liste med UserPublicKeyResponse</returns>
    Task<Result<List<UserPublicKeyResponse>>> GetPublicKeysForUsersAsync(List<string> userIds,
        CancellationToken ct = default);

    /// <summary>
    /// Henter brukerens egen aktive PublicKey. Brukes for å sjekke om E2EE er satt opp
    /// </summary>
    /// <param name="userId">BrukerId</param>
    /// <param name="ct"></param>
    /// <returns>UserPublicKeyResponse med UserId, PublicKey og KeyVersion</returns>
    Task<Result<UserPublicKeyResponse>> GetMyPublicKeyAsync(string userId, CancellationToken ct = default);
}
