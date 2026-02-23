using AFBack.Common.DTOs;

namespace AFBack.DTOs;
// Brukes til å hente om en bruker er venn eller ikke, samt ved sletting og oppretting
public class FriendDTO
{
    public int CurrentUserId { get; set; } // Henter den innloggede brukeren
    public DateTime CreatedAt { get; set; } // Når vennskapet ble laget

    public int UserToFriendUserScore { get; set; } 
    public int FriendUserToUserScore { get; set; }
    
    public UserSummaryDto Friend { get; set; } = null!;
}