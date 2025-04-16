namespace AFBack.DTOs;

public class FriendInvitationDTO
{
    public int Id { get; set; }
    public int SenderId { get; set; }
    public int ReceiverId { get; set; }
    public string Status { get; set; } = "Pending";
    public DateTime SentAt { get; set; }
}
