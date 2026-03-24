using AFBack.Common.Enum;
using AFBack.Common.Results;
using AFBack.Features.Conversation.Repository;
using AFBack.Features.Conversation.Validators;
using AFBack.Features.Messaging.DTOs.Response;
using AFBack.Features.Messaging.Models;
using AFBack.Features.Messaging.Repository;
using AFBack.Infrastructure.KeyVault.Services;


namespace AFBack.Features.Messaging.Services;

public class EncryptionService(
    IUserPublicKeyRepository userPublicKeyRepository,
    ILogger<EncryptionService> logger,
    IConversationRepository conversationRepository,
    IConversationValidator conversationValidator,
    IKeyVaultService keyVaultService) : IEncryptionService
{
    /// <inheritdoc/>
    public async Task<Result<StoreUserPublicKeyResponse>> StoreUserPublicKeyAsync(string userId, string publicKey)
    {
        var keyBytes = Convert.FromBase64String(publicKey);
        if (keyBytes.Length != 32)
        {
            logger.LogWarning("Invalid key format. PublicKey is {KeyBytesLength} bytes", keyBytes.Length);
            return Result<StoreUserPublicKeyResponse>.Failure("Invalid key format", AppErrorCode.InvalidPublicKey);
        }
        
        // Sjekker om brukeren har en eksisterende key, og deaktiverer den isåfall
        var existingKey = await userPublicKeyRepository.GetActiveUserPublicKeyAsync(userId);
        if (existingKey != null)
            existingKey.IsActive = false;
        
        // Inkrementer eller setter versjonen
        var newVersion = existingKey == null ? 1 : existingKey.KeyVersion + 1;
        
        // Create new key
        var newKey = new UserPublicKey
        {
            UserId = userId,
            PublicKey = publicKey,
            KeyVersion = newVersion,
            CreatedAt = DateTime.UtcNow,
            IsActive = true
        };

        await userPublicKeyRepository.AddAsync(newKey);
        logger.LogInformation("Stored new Sodium public key for User {UserId}, version {Version}", 
            userId, newKey.KeyVersion);

        return Result<StoreUserPublicKeyResponse>.Success(new StoreUserPublicKeyResponse
        {
            KeyVersion = newKey.KeyVersion
        });
    }
    
    /// <inheritdoc/>
    public async Task<Result<ConversationKeysResponse>> GetConversationKeysAsync(string userId, int conversationId)
    {
        // ===== Hetner samtalen og validerer at brukeren har tilgang til samtalen =====
        var conversation = await conversationRepository.GetConversationAsync(conversationId);
    
        var conversationResult = conversationValidator.ValidateConversationExists(userId, conversationId, conversation);
        if (conversationResult.IsFailure)
            return Result<ConversationKeysResponse>.Failure(conversationResult.Error, conversationResult.ErrorCode);

        var participantResult = conversationValidator.ValidateParticipant(userId, conversation!);
        if (participantResult.IsFailure)
            return Result<ConversationKeysResponse>.Failure(participantResult.Error, participantResult.ErrorCode);

        var notArchivedResult = conversationValidator.ValidateNotArchived(participantResult.Value!);
        if (notArchivedResult.IsFailure)
            return Result<ConversationKeysResponse>.Failure(notArchivedResult.Error, notArchivedResult.ErrorCode);

        var participantIds = conversation!.Participants
            .Where(p => !p.ConversationArchived)
            .Select(p => p.UserId)
            .ToList();
        
        var keys = await userPublicKeyRepository.GetActiveKeysForUsersAsync(participantIds);

        return Result<ConversationKeysResponse>.Success(new ConversationKeysResponse
        {
            ParticipantKeys = keys.Select(k => new UserPublicKeyResponse
            {
                UserId = k.UserId,
                PublicKey = k.PublicKey,
                KeyVersion = k.KeyVersion
            }).ToList()
        });
    }
    
    /// <inheritdoc/>
    public async Task<Result<List<UserPublicKeyResponse>>> GetPublicKeysForUsersAsync(List<string> userIds)
    {
        var keys = await userPublicKeyRepository.GetActiveKeysForUsersAsync(userIds);

        var response = keys.Select(k => new UserPublicKeyResponse
        {
            UserId = k.UserId,
            PublicKey = k.PublicKey,
            KeyVersion = k.KeyVersion
        }).ToList();

        return Result<List<UserPublicKeyResponse>>.Success(response);
    }
    
    /// <inheritdoc/>
    public async Task<Result<UserPublicKeyResponse>> GetMyPublicKeyAsync(string userId)
    {
        var key = await userPublicKeyRepository.GetActiveUserPublicKeyAsync(userId);

        if (key == null)
        {
            logger.LogInformation("No public key for User {UserId} found", userId);
            return Result<UserPublicKeyResponse>.Failure("No public key found", AppErrorCode.NotFound);
        }
        
        return Result<UserPublicKeyResponse>.Success(new UserPublicKeyResponse
        {
            UserId = key.UserId,
            PublicKey = key.PublicKey,
            KeyVersion = key.KeyVersion
        });
    }
    
    /// <inheritdoc/>
    public async Task<Result> StoreRecoverySeedAsync(string userId, int deviceId, string key)
    {
        var storeRecoveryResult = await keyVaultService.StoreRecoverySeedAsync(userId, deviceId, key);
        if (storeRecoveryResult.IsFailure)
            return Result.Failure(storeRecoveryResult.Error, storeRecoveryResult.ErrorCode);

        return Result.Success();
    }
    
}
