namespace AFBack.Interface.Repository;

public interface IUserBlockRepository
{
    Task<bool> IsFirstUserBlockedBySecondary(int userId, int blockedBy);
}
