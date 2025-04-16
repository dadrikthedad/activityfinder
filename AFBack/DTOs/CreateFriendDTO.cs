namespace AFBack.DTOs;
// Bruker denne ved opprettelse av vennskap mellom to brukere. Trenger ikke scoren i dette tilfellet
public class CreateFriendDTO
{
    public int UserId { get; set; }
    public int FriendId { get; set; }
}