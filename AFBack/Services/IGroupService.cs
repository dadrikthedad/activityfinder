using AFBack.Models;

namespace AFBack.Services;

public interface IGroupService
{
    Task<GroupMessage> CreateGroupAsync(string groupName);
    Task AddUserToGroupAsync(int groupId, string userId);
    Task RemoveUserFromGroupAsync(int groupId, string userId);
    Task<List<GroupMessage>> GetUserGroupsAsync(string userId);
    Task<GroupMessage?> GetGroupByIdAsync(int groupId);
}