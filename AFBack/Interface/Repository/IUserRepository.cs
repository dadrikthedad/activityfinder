namespace AFBack.Interface.Repository;

public interface IUserRepository
{
    Task<bool> UserExistsAsync(int userId);

    Task<Dictionary<int, (string FullName, string? ProfileImageUrl)>>
        GetUserSummaries(IEnumerable<int> userIds);
}