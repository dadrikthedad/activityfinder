namespace AFBack.Cache;

public interface ISendMessageCache
{
    /// <summary>
    /// Sjekker om en bruker kan sende meldinger til en samtale (med cache). Ved miss så henter fra databasen
    /// </summary>
    Task<bool> CanUserSendAsync(string userId, int conversationId);
    
    /// <summary>
    /// Oppdaterer cache når en ny CanSend legges til
    /// </summary>
    Task OnCanSendAddedAsync(string userId, int conversationId);
    
    /// <summary>
    /// Oppdaterer cache når en CanSend fjernes
    /// </summary>
    Task OnCanSendRemovedAsync(string userId, int conversationId);
} 
