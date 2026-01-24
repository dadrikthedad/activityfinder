namespace AFBack.Repository;

public interface IUserBlockRepository
{
    Task<bool> IsFirstUserBlockedBySecondary(string userId, string blockedById);
}
