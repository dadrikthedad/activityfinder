namespace AFBack.Services;
using AFBack.Data;
using AFBack.Models;
using Microsoft.EntityFrameworkCore;

public class GroupService : IGroupService
{
    private readonly ApplicationDbContext _context;

    public GroupService(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<GroupMessage> CreateGroupAsync(string groupName)
    {
        if (await _context.Groups.AnyAsync(g => g.Name == groupName))
        {
            throw new Exception("En gruppe med dette navnet finnes allerede.");
        }

        var group = new GroupMessage { Name = groupName };
        _context.Groups.Add(group);
        await _context.SaveChangesAsync();
        return group;
    }

    public async Task AddUserToGroupAsync(int groupId, string userId)
    {
        if (await _context.GroupMembers.AnyAsync(gm => gm.GroupId == groupId && gm.UserId == userId))
            return; // Allerede medlem

        var groupMember = new GroupMessageMember
        {
            GroupId = groupId,
            UserId = userId
        };

        _context.GroupMembers.Add(groupMember);
        await _context.SaveChangesAsync();
    }

    public async Task RemoveUserFromGroupAsync(int groupId, string userId)
    {
        var member = await _context.GroupMembers
            .FirstOrDefaultAsync(gm => gm.GroupId == groupId && gm.UserId == userId);

        if (member != null)
        {
            _context.GroupMembers.Remove(member);
            await _context.SaveChangesAsync();
        }
    }

    public async Task<List<GroupMessage>> GetUserGroupsAsync(string userId)
    {
        return await _context.Groups
            .Where(g => g.Members.Any(m => m.UserId == userId))
            .Include(g => g.Members)
            .ToListAsync();
    }
    
    public async Task<GroupMessage?> GetGroupByIdAsync(int groupId)
    {
        return await _context.Groups
            .Include(g => g.Members) // Hvis du vil hente medlemmene samtidig (valgfritt)
            .FirstOrDefaultAsync(g => g.Id == groupId);
    }
}