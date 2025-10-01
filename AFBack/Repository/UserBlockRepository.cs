using AFBack.Data;
using Microsoft.EntityFrameworkCore;

namespace AFBack.Interface.Repository;

public class UserBlockRepository : IUserBlockRepository
{
    private readonly ApplicationDbContext _context;
    
    public UserBlockRepository(ApplicationDbContext context)
    {
        _context = context;
    }
    
    // Sjekker om første innsendte bruker er blokkert av andre bruker
    public async Task<bool> IsFirstUserBlockedBySecondary(int UserId, int BlockedById) =>
        await _context.UserBlocks.AsNoTracking().AnyAsync(x => x.BlockedUserId == UserId && x.BlockerId == BlockedById);
}