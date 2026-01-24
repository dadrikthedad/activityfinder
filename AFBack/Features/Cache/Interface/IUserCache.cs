using AFBack.Models;
using AFBack.Models.Auth;

namespace AFBack.Features.Cache.Interface;

public interface IUserCache
{
    Task<bool> UserExistsAsync(string userId);
    Task<AppUser?> GetUserAsync(string userId);
}
