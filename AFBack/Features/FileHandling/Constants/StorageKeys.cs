namespace AFBack.Features.FileHandling.Constants;

/// <summary>
/// Sentraliserte storage keys for Azure Blob Storage.
/// Sikrer konsistente stier på tvers av upload og delete operasjoner.
/// </summary>
public static class StorageKeys
{
    /// <summary>
    ///  Oppretter en ProfileImage StorageKey. "profiles/{userId}/profileimage"
    /// </summary>
    /// <param name="userId">Setter key med bruker Id</param>
    /// <returns>En ferdig StorageKey: $"profiles/4/profileimage"</returns>
    public static string ProfileImage(string userId) 
        => $"profiles/{userId}/profileimage";
    
    /// <summary>
    /// Oppretter en GroupImage StorageKey. "conversation/{conversationId}/groupimage"
    /// </summary>
    /// <param name="conversationId">Setter nøkkelen med conversationId</param>
    /// <returns>En ferdig StorageKey: $"conversation/83/groupimage"</returns>
    public static string GroupImage(int conversationId) 
        => $"conversation/{conversationId}/groupimage";
    
    /// <summary>
    /// Oppretter en MessageAttachment StorageKey i "messages/{conversationId}/{fileId}.enc"
    /// </summary>
    /// <param name="conversationId">Setter nøkkelen med conversationId</param>
    /// <param name="fileId">fileId til filen</param>
    /// <returns>En ferdig StorageKey: $"messages/14//3".enc</returns>
    public static string MessageAttachment(int conversationId, Guid fileId) 
        => $"messages/{conversationId}/{fileId}.enc";
    
    /// <summary>
    /// Oppretter en Thumbnail StorageKey for en MessageAttachment i
    /// "messages/{conversationId}/thumb_{fileId}.enc
    /// </summary>
    /// <param name="conversationId">Setter nøkkelen med conversationId</param>
    /// <param name="fileId">fileId til filen</param>
    /// <returns>En ferdig StorageKey: $"messages/14/887/thumb_3.enc"</returns>
    public static string MessageThumbnail(int conversationId, Guid fileId) 
        => $"messages/{conversationId}/thumb_{fileId}.enc";
}
