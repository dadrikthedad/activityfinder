using AFBack.Features.Searching.DTOs.Responses;

namespace AFBack.Features.Searching.Repositories;

public interface ISearchRepository
{
    /// <summary>
    /// Søker igjennom alle brukere med Cursor-tilnærming og ProximityLevel utifra avstand fra brukeren.
    /// Først så henter vi brukerens profil, deretter gir vi brukere en score utifra hvor nærme de er.
    /// Vi bruker deretter Cursor for å kunne hoppe tilbake ditt vi er i søket, også tar vi med en ekstra
    /// bruker for å kunne sjekke om det er flere brukere.
    /// Cursor: Proximity, Navn, så Id: "2|Kari Hansen|abc123"
    /// </summary>
    /// <param name="searchQuery">Søkestrengen</param>
    /// <param name="requestingUserId">Brukeren som søker</param>
    /// <param name="cursor">String? for å huske hvor vi er</param>
    /// <param name="pageSize">Antall brukere å hente</param>
    /// <returns>List med UserSearchResult</returns>
    Task<List<UserSearchResult>> SearchUsersAsync(string searchQuery, string requestingUserId, 
        string? cursor, int pageSize);
    
    /// <summary>
    /// Raskt søk. Bruker ID som cursor for å huske hvor vi var. Cursor: ID: "abc123kdsolaik"
    /// </summary>
    /// <param name="searchQuery">Søkestrengen</param>
    /// <param name="requestingUserId">Brukeren som søker</param>
    /// <param name="cursor">String? for å huske hvor vi er</param>
    /// <param name="pageSize">Antall brukere å hente</param>
    /// <returns>List med UserSearchResult</returns>
    Task<List<UserSearchResult>> QuickSearchUsersAsync(
        string searchQuery, string requestingUserId, string? cursor, int pageSize);

    
    /// <summary>
    /// Søker igjennom brukere for invitasjon til opprettelse av gruppesamtale eller eksisterende gruppe.
    /// Vi filtrerer bort blokkerte brukere, og brukere som har blokkert brukeren som søker.
    /// Vi filtrerer bort allerede inviterte medlemmer, og brukere som har forlatt samtalen.
    /// Bruker cursor for å huske hvor vi var i søket. Cursor: "fullName|userId"
    /// </summary>
    /// <param name="searchQuery">Søkestrengen</param>
    /// <param name="requestingUserId">Brukeren som søker</param>
    /// <param name="conversationId">Optional ConversationId: er null hvis ny samtale</param>
    /// <param name="cursor">String? for å huske hvor vi er</param>
    /// <param name="pageSize">Antall brukere å hente</param>
    /// <returns>List med UserSearchResult</returns>
    Task<List<UserSearchResult>> SearchUsersForGroupInviteAsync(string searchQuery, string requestingUserId,
        int? conversationId, string? cursor, int pageSize);
}
