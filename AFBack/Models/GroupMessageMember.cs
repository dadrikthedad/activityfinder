namespace AFBack.Models;

public class GroupMessageMember
{
    public int Id { get; set; }
    public int GroupId { get; set; }
    public string UserId { get; set; } = null!;

    public GroupMessage GroupMessage { get; set; } = null!;
}