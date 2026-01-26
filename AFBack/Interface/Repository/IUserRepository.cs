using AFBack.DTOs;

namespace AFBack.Interface.Repository;

public interface IUserRepository
{
    Task<bool> UserExistsAsync(string userId);

    Task<Dictionary<int, (string FullName, string? ProfileImageUrl)>>
        GetUserSummaries(IEnumerable<int> userIds);


    Task<UserSummaryDto?> GetUserSummaryAsync(string userId);
    Task<Dictionary<string, UserSummaryDto>> GetUserSummariesAsync(List<string> userIds);
}
