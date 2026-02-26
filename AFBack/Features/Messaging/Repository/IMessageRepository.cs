using AFBack.Features.Messaging.DTOs;
using AFBack.Features.Messaging.Models;

namespace AFBack.Features.Messaging.Repository;

public interface IMessageRepository
{
    /// <summary>
    /// Gjør en rask sjekk om en melding eksisterer og returnere en bool
    /// </summary>
    /// <param name="messageId"></param>
    /// <returns>True hvis den eksistere, false hvis ikke</returns>
    Task<bool> MessageExistsAsync(int messageId);
    
    /// <summary>
    /// Sjekker at en melding eksisterer i en samtale
    /// </summary>
    /// <param name="messageId">ID-en til meldingen</param>
    /// <param name="conversationId">Samtalen</param>
    /// <returns>True hvis den eksisterer, false hvis ikke</returns>
    Task<bool> MessageExistsInConversationAsync(int messageId, int conversationId);

    /// <summary>
    /// Henter et MessageDto for å kun hente nødvendig egenskaper for å returnere et rask Response
    /// </summary>
    /// <param name="messageId">Meldingen vi skal hente til</param>
    /// <returns>MessageDto eller null</returns>
    Task<MessageDto?> GetMessageDtoAsync(int messageId);
    
    /// <summary>
    /// Henter meldinger for en samtale med paginering, sortert nyeste først.
    /// </summary>
    /// <param name="conversationId">Samtalen meldingene tilhører</param>
    /// <param name="page">Sidenummer (1-indeksert)</param>
    /// <param name="pageSize">Antall meldinger per side</param>
    /// <returns>Liste med MessageDto</returns>
    Task<List<MessageDto>> GetMessagesByConversationIdAsync(int conversationId, int page, int pageSize);
    
    /// <summary>
    /// Teller antall meldinger i en samtale.
    /// </summary>
    /// <param name="conversationId">Samtalen som skal telles</param>
    /// <returns>Antall meldinger</returns>
    Task<int> GetMessageCountByConversationIdAsync(int conversationId);
    
    /// <summary>
    /// Henter de nyeste meldingene for flere samtaler i én spørring.
    /// Optimalisert for initial load - henter X meldinger per samtale.
    /// </summary>
    /// <param name="conversationIds">Liste med samtale-IDer</param>
    /// <param name="messagesPerConversation">Antall meldinger per samtale</param>
    /// <returns>Dictionary med conversationId som nøkkel og liste med meldinger som verdi</returns>
    Task<Dictionary<int, List<MessageDto>>> GetMessagesForConversationsAsync(
        List<int> conversationIds, int messagesPerConversation);
    
    /// <summary>
    /// Henter meldinger for flere samtaler med innebygd validering i én spørring.
    /// Optimalisert metode som filtrerer på brukerens aksepterte samtaler og henter meldinger.
    /// </summary>
    /// <param name="userId">Brukeren som henter meldinger</param>
    /// <param name="conversationIds">Liste med samtale-IDer å hente fra</param>
    /// <param name="messagesPerConversation">Antall meldinger per samtale</param>
    /// <returns>Dictionary med conversationId som nøkkel og liste med meldinger som verdi</returns>
    Task<Dictionary<int, List<MessageDto>>> GetMessagesForConversationsWithValidationAsync(
        string userId, List<int> conversationIds, int messagesPerConversation);

    /// <summary>
    /// Henter meldinger med all nødvendig data for validering i én spørring.
    /// Optimalisert metode som kombinerer samtalevalidering, meldingshenting og count.
    /// </summary>
    /// <param name="userId">Brukeren som henter meldinger</param>
    /// <param name="conversationId">Samtalen meldingene tilhører</param>
    /// <param name="page">Sidenummer (1-indeksert)</param>
    /// <param name="pageSize">Antall meldinger per side</param>
    /// <returns>Kombinert resultat med validering og meldinger</returns>
    Task<ConversationMessagesDto> GetMessagesWithValidationAsync(string userId, int conversationId, 
        int page, int pageSize);
    
    
    /// <summary>
    /// Henter et attachment sin storage key med validering av at brukeren er deltaker i samtalen.
    /// Optimalisert for å generere fersk SAS URL.
    /// </summary>
    /// <param name="userId">Brukeren som ber om tilgang</param>
    /// <param name="attachmentId">Attachmentet som skal hentes</param>
    /// <returns>AttachmentDownloadResponse med storage keys, eller null hvis ikke funnet/ingen tilgang</returns>
    Task<AttachmentDownloadDto?> GetAttachmentKeysForDownloadAsync(string userId, int attachmentId);
    
    /// <summary>
    /// Legger til en melding og lagrer i databasen
    /// </summary>
    /// <param name="message">Melding</param>
    /// <returns>Melding nå med Id</returns>
    Task<Message> SaveMessageAsync(Message message);
    
    /// <summary>
    /// Henter nødvendig data for å validere og slette en melding i én spørring.
    /// Inkluderer meldingsinfo og brukerens deltakerstatus.
    /// </summary>
    /// <param name="userId">Brukeren som prøver å slette</param>
    /// <param name="messageId">Meldingen som skal slettes</param>
    /// <returns>DeleteMessageQueryResult med valideringsdata</returns>
    Task<Message?> GetMessageForDeletionAsync(string userId, int messageId);

    /// <summary>
    /// Lagrer i databasen
    /// </summary>
    Task SaveChangesAsync();
}
