using AFBack.Models;

namespace AFBack.Features.Cache.Interface;

public interface IUserCache
{
    Task<bool> UserExistsAsync(int userId);
    Task<User?> GetUserAsync(int userId);
}