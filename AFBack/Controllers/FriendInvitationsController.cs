
    
    /* ---------- HENT ÉN INVITASJON ---------- */
    [HttpGet("{id:int}")]
    public async Task<ActionResult<FriendInvitationDTO>> GetInvitationById(int id)
    {
        if (!int.TryParse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value, out var userId))
            return Unauthorized();

        var inv = await Context.FriendInvitations
            .FirstOrDefaultAsync(i =>
                i.Id == id &&
                (i.ReceiverId == userId || i.SenderId == userId)); // sikkerhet

        if (inv == null) return NotFound();

        // 🎯 Hent sender med relationship data fra current appUser sitt perspektiv
        var senderSummary = await UserSummaryExtensions.GetUserSummaryWithRelationshipAsync(
            Context,
            inv.SenderId,
            userId // current appUser's perspective
        );

        if (senderSummary == null) return NotFound("Sender not found");

        var invitationDto = inv.ToFriendInvitationDto(senderSummary);
        return Ok(invitationDto);
    }

    /* ---------- HENT ALLE (eksisterende) ---------- */
    [HttpGet("received")]
    public async Task<ActionResult<List<FriendInvitationDTO>>> GetReceivedInvitations(
        int pageNumber = 1, int pageSize = 10)
    {
        try
        {
            if (!int.TryParse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value, out var userId))
                return Unauthorized(new { message = "Invalid appUser ID in token." });

            // 🎯 Bruk FriendService istedenfor direkte database-logikk
            var (invitations, totalCount) = await friendService.GetPendingFriendInvitationsAsync(
                userId, pageNumber, pageSize);

            var response = new
            {
                TotalCount = totalCount,
                PageNumber = pageNumber,
                PageSize = pageSize,
                Data = invitations
            };

            return Ok(response);
        }
        catch (ArgumentException ex)
        {
            // FriendService kaster ArgumentException for ugyldig input
            return BadRequest(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = $"An error occurred while retrieving invitations. Error: {ex}" });
        }
    }

    
    // GET: Hent status mellom to brukere
    [HttpGet("between/{otherUserId}")]
    public async Task<IActionResult> GetStatusBetweenUsers(int otherUserId)
    {
        if (!int.TryParse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value, out var userId))
        {
            return Unauthorized(new { message = "Invalid appUser ID in token." });
        }
        
        var invitation = await Context.FriendInvitations
            .Where(x =>
                (x.SenderId == userId && x.ReceiverId == otherUserId) ||
                (x.SenderId == otherUserId && x.ReceiverId == userId))
            .OrderByDescending(x => x.SentAt)
            .FirstOrDefaultAsync();

        if (invitation == null)
            return Ok(new { status = "none" });

        return Ok(new
        {
            status = invitation.Status.ToString().ToLower(),
            senderId = invitation.SenderId,
            receiverId = invitation.ReceiverId,
            sentAt = invitation.SentAt
        });
    }
    
    [HttpGet("rejected")]
    public async Task<IActionResult> GetRejectedFriendInvitations()
    {
        var userId = GetUserId();
        if (userId == null)
            return Unauthorized("Ugyldig eller manglende bruker-ID i token.");

        // Hent avslåtte venneforespørsler hvor innlogget bruker er mottaker
        var rejectedInvitations = await Context.FriendInvitations
            .AsNoTracking()
            .Where(fi => fi.ReceiverId == userId.Value &&  // <-- Endring her
                         fi.Status == FriendshipRequestStatus.Declined)
            .OrderByDescending(fi => fi.SentAt)
            .ToListAsync();

        // Bygg FriendInvitationDTO liste med UserSummary for hver sender
        var rejectedInvitationsDTO = new List<FriendInvitationDTO>();

        foreach (var invitation in rejectedInvitations)
        {
            // Hent UserSummary for senderen med relationship info
            var senderSummary = await UserSummaryExtensions.GetUserSummaryWithRelationshipAsync(
                Context, 
                invitation.SenderId, 
                userId.Value);

            if (senderSummary != null)
            {
                rejectedInvitationsDTO.Add(new FriendInvitationDTO
                {
                    Id = invitation.Id,
                    UserSummary = senderSummary,
                    ReceiverId = invitation.ReceiverId,
                    Status = invitation.Status.ToString(),
                    SentAt = invitation.SentAt
                });
            }
        }

        return Ok(rejectedInvitationsDTO);
    }
    
}
