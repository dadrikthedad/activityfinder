namespace AFBack.Models;

public class GroupMessage
{
    public int Id { get; set; }
    public string Name { get; set; } = null!;
    public List<GroupMessageMember> Members { get; set; } = new();
}