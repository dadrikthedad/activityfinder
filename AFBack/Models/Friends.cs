using System.ComponentModel.DataAnnotations.Schema;

namespace AFBack.Models;
// standard venneliste
public class Friends
{
    // Id for foreing key
    public int UserId { get; set; } 
    // Bruker for å referer til brukeren for å hente ut data hvis det trengs
    public User User { get; set; } = null!;
    
    // Id for foreign key
    public int FriendId { get; set; } 
    public User FriendUser { get; set; } = null!;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    
    // 🎯 Poeng gitt av User til Friend
    public int UserToFriendUserScore { get; set; } = 0;

    // 🎯 Poeng gitt av Friend til User
    public int FriendUserToUserScore { get; set; } = 0;
}
