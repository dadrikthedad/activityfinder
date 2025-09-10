using AFBack.Data;
using AFBack.DTOs;
using AFBack.DTOs.Crypto;
using AFBack.Models;
using AFBack.Models.Crypto;
using Microsoft.EntityFrameworkCore;
using Newtonsoft.Json;

namespace AFBack.Services.Crypto;

public class E2EEService
    {
        private readonly ApplicationDbContext _context;
        private readonly ILogger<E2EEService> _logger;

        public E2EEService(ApplicationDbContext context, ILogger<E2EEService> logger)
        {
            _context = context;
            _logger = logger;
        }

        public async Task<UserPublicKey?> StoreUserPublicKeyAsync(int userId, string publicKey)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(publicKey))
                {
                    throw new ArgumentException("Public key cannot be empty");
                }

                // Validate Sodium key format
                if (!IsValidSodiumKey(publicKey))
                {
                    throw new ArgumentException("Invalid public key format. Expected 32-byte Sodium key.");
                }

                // Deactivate old keys
                var existingKeys = await _context.UserPublicKeys
                    .Where(k => k.UserId == userId && k.IsActive)
                    .ToListAsync();

                foreach (var key in existingKeys)
                {
                    key.IsActive = false;
                }

                // Create new key
                var newKey = new UserPublicKey
                {
                    UserId = userId,
                    PublicKey = publicKey,
                    KeyVersion = existingKeys.Any() ? existingKeys.Max(k => k.KeyVersion) + 1 : 1,
                    CreatedAt = DateTime.UtcNow,
                    IsActive = true
                };

                _context.UserPublicKeys.Add(newKey);
                await _context.SaveChangesAsync();

                _logger.LogInformation("Stored new Sodium public key for user {UserId}, version {Version}", 
                    userId, newKey.KeyVersion);

                return newKey;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to store public key for user {UserId}", userId);
                throw;
            }
        }
        
        
        private bool IsValidSodiumKey(string publicKey)
        {
            try
            {
                var keyBytes = Convert.FromBase64String(publicKey);
                return keyBytes.Length == 32; // Sodium X25519 public keys are 32 bytes
            }
            catch
            {
                return false;
            }
        }

        public async Task<List<UserPublicKeyDTO>> GetPublicKeysForUsersAsync(List<int> userIds)
        {
            try
            {
                var keys = await _context.UserPublicKeys
                    .Where(k => userIds.Contains(k.UserId) && k.IsActive)
                    .Include(k => k.User)
                    .ToListAsync();

                return keys.Select(k => new UserPublicKeyDTO
                {
                    UserId = k.UserId,
                    PublicKey = k.PublicKey,
                    KeyVersion = k.KeyVersion,
                    CreatedAt = k.CreatedAt.ToString("O")
                }).ToList();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to get public keys for users {UserIds}", string.Join(",", userIds));
                throw;
            }
        }

        public async Task<ConversationKeyDTO?> GetConversationKeysAsync(int conversationId, int requestingUserId)
        {
            try
            {
                var conversation = await _context.Conversations
                    .Include(c => c.Participants.Where(cp => !cp.HasDeleted)) // Filtrer ut slettede
                    .ThenInclude(cp => cp.User)
                    .FirstOrDefaultAsync(c => c.Id == conversationId);

                if (conversation == null)
                {
                    _logger.LogWarning("Conversation {ConversationId} not found", conversationId);
                    return null;
                }

                // Check if user is participant (og ikke har slettet)
                if (conversation.Participants.All(cp => cp.UserId != requestingUserId))
                {
                    _logger.LogWarning("User {UserId} is not a participant in conversation {ConversationId}", 
                        requestingUserId, conversationId);
                    return null;
                }

                var participantIds = conversation.Participants
                    .Select(cp => cp.UserId)
                    .ToList();

                var publicKeys = await GetPublicKeysForUsersAsync(participantIds);

                return new ConversationKeyDTO
                {
                    ConversationId = conversationId,
                    ParticipantKeys = publicKeys,
                    KeyRotationVersion = 1
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to get conversation keys for conversation {ConversationId}", conversationId);
                throw;
            }
        }

        public async Task<Message?> StoreEncryptedMessageAsync(
            SendEncryptedMessageRequestDTO request, 
            int senderId)
        {
            try
            {
                // Validate request
                if (!request.HasValidContent)
                {
                    throw new ArgumentException("Message must have either encrypted text or attachments");
                }

                // Validate that message has content (text or attachments)
                if (string.IsNullOrEmpty(request.EncryptedText) && 
                    (request.EncryptedAttachments == null || !request.EncryptedAttachments.Any()))
                {
                    throw new ArgumentException("Message must have either encrypted text or attachments");
                }

                // Only require KeyInfo if there's encrypted text
                if (!string.IsNullOrEmpty(request.EncryptedText) && 
                    (request.KeyInfo == null || !request.KeyInfo.Any()))
                {
                    throw new ArgumentException("KeyInfo is required for text messages");
                }

                // Only require IV if there's encrypted text
                if (!string.IsNullOrEmpty(request.EncryptedText) && string.IsNullOrEmpty(request.IV))
                {
                    throw new ArgumentException("IV is required for text messages");
                }
                

                // Validate conversation access
                if (request.ConversationId.HasValue)
                {
                    var hasAccess = await _context.ConversationParticipants
                        .AnyAsync(cp => cp.ConversationId == request.ConversationId && cp.UserId == senderId);
                    
                    if (!hasAccess)
                    {
                        throw new UnauthorizedAccessException("User not authorized for this conversation");
                    }
                }

                var message = new Message
                {
                    SenderId = senderId,
                    EncryptedText = request.EncryptedText,
                    KeyInfo = JsonConvert.SerializeObject(request.KeyInfo),
                    IV = request.IV,
                    Version = request.Version,
                    ConversationId = request.ConversationId ?? 0,
                    ParentMessageId = request.ParentMessageId,
                    ParentMessagePreview = request.ParentMessagePreview,
                    SentAt = DateTime.UtcNow,
                    IsSystemMessage = false,
                    IsDeleted = false
                };

                _context.Messages.Add(message);
                await _context.SaveChangesAsync();

                // Handle encrypted attachments
                if (request.EncryptedAttachments?.Any() == true)
                {
                    _logger.LogInformation("🔐🐛 ATTEMPTING TO STORE MESSAGE: ConversationId={ConversationId}, SenderId={SenderId}, HasAttachments={HasAttachments}", 
                        request.ConversationId, senderId, request.EncryptedAttachments?.Count > 0);
                    
                    var attachments = request.EncryptedAttachments.Select(att => new MessageAttachment
                    {
                        EncryptedFileUrl = att.EncryptedFileUrl,
                        FileType = att.FileType,
                        OriginalFileName = att.FileName,
                        OriginalFileSize = att.FileSize ?? 0,
                        KeyInfo = JsonConvert.SerializeObject(att.KeyInfo),
                        IV = att.IV,
                        Version = att.Version,
                        CreatedAt = DateTime.UtcNow,

                        // Thumbnail-felter:
                        EncryptedThumbnailUrl = att.EncryptedThumbnailUrl,
                        ThumbnailKeyInfo = att.ThumbnailKeyInfo != null 
                            ? JsonConvert.SerializeObject(att.ThumbnailKeyInfo) 
                            : null,
                        ThumbnailIV = att.ThumbnailIV,
                        ThumbnailWidth = att.ThumbnailWidth,
                        ThumbnailHeight = att.ThumbnailHeight
                    }).ToList();

                    foreach (var attachment in attachments)
                    {
                        message.Attachments.Add(attachment);
                    }
                    
                    await _context.SaveChangesAsync();
                    _logger.LogInformation("🔐✅ MESSAGE SAVED SUCCESSFULLY: MessageId={MessageId}", message.Id);
                }

                _logger.LogInformation("Stored encrypted message {MessageId} from user {UserId} in conversation {ConversationId}", 
                    message.Id, senderId, message.ConversationId);

                return await GetEncryptedMessageWithDetailsAsync(message.Id);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to store encrypted message from user {UserId}", senderId);
                throw;
            }
        }
        
        public async Task<Message?> GetEncryptedMessageWithDetailsAsync(int messageId)
        {
            return await _context.Messages
                .Include(m => m.Sender)
                .Include(m => m.Attachments)
                .Include(m => m.Reactions)
                .FirstOrDefaultAsync(m => m.Id == messageId);
        }

        public async Task<List<EncryptedMessageResponseDTO>> GetEncryptedMessagesForConversationAsync(
            int conversationId, 
            int userId, 
            int skip = 0, 
            int take = 50)
        {
            try
            {
                // Verify user access
                var hasAccess = await _context.ConversationParticipants
                    .AnyAsync(cp => cp.ConversationId == conversationId && cp.UserId == userId);

                if (!hasAccess)
                {
                    throw new UnauthorizedAccessException("User not authorized for this conversation");
                }

                var messages = await _context.Messages
                    .Where(m => m.ConversationId == conversationId)
                    .Include(m => m.Sender)
                    .Include(m => m.Attachments)
                    .OrderByDescending(m => m.SentAt)
                    .Skip(skip)
                    .Take(take)
                    .ToListAsync();

                return messages.Select(m => new EncryptedMessageResponseDTO
                {
                    Id = m.Id,
                    SenderId = m.SenderId,
                    EncryptedText = m.EncryptedText,
                    KeyInfo = JsonConvert.DeserializeObject<Dictionary<string, string>>(m.KeyInfo) 
                              ?? new Dictionary<string, string>(),
                    IV = m.IV,
                    Version = m.Version,
                    SentAt = m.SentAt.ToString("O"),
                    ConversationId = m.ConversationId,
                    EncryptedAttachments = m.Attachments.Select(a => new EncryptedAttachmentDto
                    {
                        EncryptedFileUrl = a.EncryptedFileUrl,
                        FileType = a.FileType,
                        FileName = a.OriginalFileName, // Endret fra a.FileName
                        FileSize = a.OriginalFileSize, // Endret fra a.FileSize
                        KeyInfo = JsonConvert.DeserializeObject<Dictionary<string, string>>(a.KeyInfo) 
                                  ?? new Dictionary<string, string>(),
                        IV = a.IV,
                        Version = a.Version
                    }).ToList(),
                    ParentMessageId = m.ParentMessageId,
                    ParentMessagePreview = m.ParentMessagePreview,
                    IsSystemMessage = m.IsSystemMessage,
                    IsDeleted = m.IsDeleted
                }).ToList();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to get encrypted messages for conversation {ConversationId}", conversationId);
                throw;
            }
        }
        
    }