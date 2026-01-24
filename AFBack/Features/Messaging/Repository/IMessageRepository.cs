using AFBack.Features.Messaging.DTOs;

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
    /// Henter et MessageDto for å kun hente nødvendig egenskaper for å returnere et rask Response
    /// </summary>
    /// <param name="messageId">Meldingen vi skal hente til</param>
    /// <returns>MessageDto eller null</returns>
    Task<MessageDto?> GetMessageDtoAsync(int messageId);

    /// <summary>
    /// Legger til en melding og lagrer i databasen
    /// </summary>
    /// <param name="message">Melding</param>
    /// <returns>Melding nå med Id</returns>
    Task<Models.Message> SaveMessageAsync(Models.Message message);
}
