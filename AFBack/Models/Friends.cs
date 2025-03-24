namespace AFBack.Models;
// standard venneliste
public class Friends
{
    public int UserId { get; set; }
    public User User { get; set; }
    
    public int FriendId { get; set; }
    public User Friend { get; set; }
}