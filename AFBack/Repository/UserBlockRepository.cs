using AFBack.Data;
using Microsoft.EntityFrameworkCore;

namespace AFBack.Repository;

public class UserBlockRepository(ApplicationDbContext context) : IUserBlockRepository
{
    // Sjekker om første innsendte bruker er blokkert av andre bruker
    public async Task<bool> IsFirstUserBlockedBySecondary(string userId, string blockedById) =>
        await context.UserBlocks.AsNoTracking().AnyAsync(x => x.BlockedUserId == userId && x.BlockerId == blockedById);
}
