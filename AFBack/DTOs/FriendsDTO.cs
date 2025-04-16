namespace AFBack.DTOs;
// Brukes til å hente om en bruker er venn eller ikke, samt ved sletting og oppretting
public class FriendDTO
{
    public int UserId { get; set; }
    public int FriendId { get; set; }
    public DateTime CreatedAt { get; set; }

    public int UserToFriendUserScore { get; set; }
    public int FriendUserToUserScore { get; set; }
}