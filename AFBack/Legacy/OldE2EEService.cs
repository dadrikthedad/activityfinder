
        // public async Task<Message?> StoreEncryptedMessageAsync(
        //     SendEncryptedMessageRequestDTO request, 
        //     int senderId)
        // {
        //     try
        //     {
        //         // Validate request
        //         if (!request.HasValidContent)
        //         {
        //             throw new ArgumentException("Message must have either encrypted text or attachments");
        //         }
        //
        //         // Validate that message has content (text or attachments)
        //         if (string.IsNullOrEmpty(request.EncryptedText) && 
        //             (request.EncryptedAttachments == null || !request.EncryptedAttachments.Any()))
        //         {
        //             throw new ArgumentException("Message must have either encrypted text or attachments");
        //         }
        //
        //         // Only require KeyInfo if there's encrypted text
        //         if (!string.IsNullOrEmpty(request.EncryptedText) && 
        //             (request.KeyInfo == null || !request.KeyInfo.Any()))
        //         {
        //             throw new ArgumentException("KeyInfo is required for text messages");
        //         }
        //
        //         // Only require IV if there's encrypted text
        //         if (!string.IsNullOrEmpty(request.EncryptedText) && string.IsNullOrEmpty(request.IV))
        //         {
        //             throw new ArgumentException("IV is required for text messages");
        //         }
        //         
        //
        //         // Validate conversation access
        //         if (request.ConversationId.HasValue)
        //         {
        //             var hasAccess = await _context.ConversationParticipants
        //                 .AnyAsync(cp => cp.ConversationId == request.ConversationId && cp.UserId == senderId);
        //             
        //             if (!hasAccess)
        //             {
        //                 throw new UnauthorizedAccessException("AppUser not authorized for this conversation");
        //             }
        //         }
        //
        //         var message = new Message
        //         {
        //             SenderId = senderId,
        //             EncryptedText = request.EncryptedText,
        //             KeyInfo = JsonConvert.SerializeObject(request.KeyInfo),
        //             IV = request.IV,
        //             Version = request.Version,
        //             ConversationId = request.ConversationId ?? 0,
        //             ParentMessageId = request.ParentMessageId,
        //             ParentMessagePreview = request.ParentMessagePreview,
        //             SentAt = DateTime.UtcNow,
        //             IsSystemMessage = false,
        //             IsDeleted = false
        //         };
        //
        //         // Handle encrypted attachments FØR vi legger til message i context
        //         if (request.EncryptedAttachments?.Any() == true)
        //         {
        //             _logger.LogInformation("🔐🐛 ATTEMPTING TO STORE {AttachmentCount} ATTACHMENTS", 
        //                 request.EncryptedAttachments.Count);
        //
        //             foreach (var att in request.EncryptedAttachments)
        //             {
        //                 var attachment = new MessageAttachment
        //                 {
        //                     // IKKE sett MessageId - la EF håndtere det
        //                     Message = message, // <-- Bruk navigation property
        //                     EncryptedFileUrl = att.EncryptedFileUrl,
        //                     FileType = att.FileType,
        //                     OriginalFileName = att.FileName,
        //                     OriginalFileSize = att.FileSize ?? 0,
        //                     KeyInfo = JsonConvert.SerializeObject(att.KeyInfo),
        //                     IV = att.IV,
        //                     Version = att.Version,
        //                     CreatedAt = DateTime.UtcNow,
        //
        //                     // Thumbnail-felter:
        //                     EncryptedThumbnailUrl = att.EncryptedThumbnailUrl,
        //                     ThumbnailKeyInfo = att.ThumbnailKeyInfo != null 
        //                         ? JsonConvert.SerializeObject(att.ThumbnailKeyInfo) 
        //                         : null,
        //                     ThumbnailIV = att.ThumbnailIV,
        //                     ThumbnailWidth = att.ThumbnailWidth,
        //                     ThumbnailHeight = att.ThumbnailHeight
        //                 };
        //
        //                 // Legg til i message sin collection
        //                 message.Attachments.Add(attachment);
        //             }
        //         }
        //
        //         // Legg til message (med attachments) i context
        //         _context.Messages.Add(message);
        //         
        //         // Lagre ALT på en gang
        //         await _context.SaveChangesAsync();
        //         
        //         _logger.LogInformation("🔐✅ MESSAGE AND ATTACHMENTS SAVED SUCCESSFULLY MessageId={MessageId}", message.Id);
        //
        //         return await GetEncryptedMessageWithDetailsAsync(message.Id);
        //     }
        //     catch (Exception ex)
        //     {
        //         _logger.LogError(ex, "Failed to store encrypted message from appUser {UserId}", senderId);
        //         throw;
        //     }
        // }
        //
    //     
    //     public async Task<Message?> GetEncryptedMessageWithDetailsAsync(int messageId)
    //     {
    //         return await _context.Messages
    //             .Include(m => m.Sender)
    //             .Include(m => m.Attachments)
    //             .Include(m => m.Reactions)
    //             .FirstOrDefaultAsync(m => m.Id == messageId);
    //     }
    //
    //     public async Task<List<EncryptedMessageResponseDTO>> GetEncryptedMessagesForConversationAsync(
    //         int conversationId, 
    //         int userId, 
    //         int skip = 0, 
    //         int take = 50)
    //     {
    //         try
    //         {
    //             // Verify appUser access
    //             var hasAccess = await _context.ConversationParticipants
    //                 .AnyAsync(cp => cp.ConversationId == conversationId && cp.UserId == userId);
    //
    //             if (!hasAccess)
    //             {
    //                 throw new UnauthorizedAccessException("AppUser not authorized for this conversation");
    //             }
    //
    //             var messages = await _context.Messages
    //                 .Where(m => m.ConversationId == conversationId)
    //                 .Include(m => m.Sender)
    //                 .Include(m => m.Attachments)
    //                 .OrderByDescending(m => m.SentAt)
    //                 .Skip(skip)
    //                 .Take(take)
    //                 .ToListAsync();
    //
    //             return messages.Select(m => new EncryptedMessageResponseDTO
    //             {
    //                 Id = m.Id,
    //                 SenderId = m.SenderId,
    //                 EncryptedText = m.EncryptedText,
    //                 KeyInfo = JsonConvert.DeserializeObject<Dictionary<string, string>>(m.KeyInfo) 
    //                           ?? new Dictionary<string, string>(),
    //                 IV = m.IV,
    //                 Version = m.Version,
    //                 SentAt = m.SentAt.ToString("O"),
    //                 ConversationId = m.ConversationId,
    //                 EncryptedAttachments = m.Attachments.Select(a => new EncryptedAttachmentDto
    //                 {
    //                     EncryptedFileUrl = a.EncryptedFileUrl,
    //                     FileType = a.FileType,
    //                     FileName = a.OriginalFileName, // Endret fra a.FileName
    //                     FileSize = a.OriginalFileSize, // Endret fra a.FileSize
    //                     KeyInfo = JsonConvert.DeserializeObject<Dictionary<string, string>>(a.KeyInfo) 
    //                               ?? new Dictionary<string, string>(),
    //                     IV = a.IV,
    //                     Version = a.Version
    //                 }).ToList(),
    //                 ParentMessageId = m.ParentMessageId,
    //                 ParentMessagePreview = m.ParentMessagePreview,
    //                 IsSystemMessage = m.IsSystemMessage,
    //                 IsDeleted = m.IsDeleted
    //             }).ToList();
    //         }
    //         catch (Exception ex)
    //         {
    //             _logger.LogError(ex, "Failed to get encrypted messages for conversation {ConversationId}", conversationId);
    //             throw;
    //         }
    //     }
    //     
    // }
