using AFBack.Features.Auth.Models;
using AFBack.Models;

namespace AFBack.Features.Cache.Interface;

public interface IUserCache
{
    Task<bool> UserExistsAsync(string userId);
    Task<AppUser?> GetUserAsync(string userId);
}
