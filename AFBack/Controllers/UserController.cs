
    [HttpGet("search/group-invite/{conversationId}")]
    public async Task<ActionResult<List<UserSummaryDto>>> SearchUsersForGroupInvite(
    [FromRoute] int conversationId,
    [FromQuery] string query)
    {
        if (string.IsNullOrWhiteSpace(query))
        {
            return BadRequest("Query cannot be empty.");
        }

        var currentUserId = GetUserId();
        
        if (currentUserId == null)
        {
            return Unauthorized();
        }

        var normalizedQuery = string.Join(" ", query
            .ToLower()
            .Split(' ', StringSplitOptions.RemoveEmptyEntries));

        // ✅ Hent blocked relationships
        var blockedUserIds = await Context.UserBlocks
            .Where(b => b.BlockerId == currentUserId || b.BlockedUserId == currentUserId)
            .Select(b => b.BlockerId == currentUserId ? b.BlockedUserId : b.BlockerId)
            .ToListAsync();

        var results = await Context.Users
            .Where(u => 
                u.FullName.ToLower().Contains(normalizedQuery) &&
                u.Id != currentUserId &&
                !blockedUserIds.Contains(u.Id) && // ✅ Ikke blocked users
                // Ikke eksisterende deltaker
                !Context.ConversationParticipants
                    .Any(cp => cp.ConversationId == conversationId && cp.UserId == u.Id) &&
                // Ikke rejected eller pending gruppeforespørsel
                !Context.GroupRequests
                    .Any(gr => gr.ConversationId == conversationId && 
                               gr.ReceiverId == u.Id &&
                               (gr.Status == GroupRequestStatus.Rejected || 
                                gr.Status == GroupRequestStatus.Pending)) &&
                // Sjekk at current appUser har tilgang (sikkerhet)
                Context.ConversationParticipants
                    .Any(cp => cp.ConversationId == conversationId && cp.UserId == currentUserId))
            .Select(u => new UserSummaryDto
            {
                Id = u.Id,
                FullName = u.FullName,
                ProfileImageUrl = u.ProfileImageUrl
            })
            .Take(20)
            .ToListAsync();

    }
