using AFBack.Data;
using AFBack.Models;
using AFBack.DTOs;
using AFBack.Hubs;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

// En service for å håndtere alle meldinger
namespace AFBack.Services;

public class MessageService : IMessageService
    {
        private readonly ApplicationDbContext _context;
        private readonly IHubContext<ChatHub> _hubContext;

        public MessageService(ApplicationDbContext context, IHubContext<ChatHub> hubContext)
        {
            _context = context;
            _hubContext = hubContext;
        }

        public async Task<MessageResponseDTO> SendMessageAsync(string senderId, SendMessageRequestDTO request)
        {
            var message = new Message
            {
                SenderId = senderId,
                ReceiverId = request.ReceiverId,
                GroupName = request.GroupName,
                Text = request.Text,
                SentAt = DateTime.UtcNow,
                Attachments = request.Attachments?.Select(a => new MessageAttachment
                {
                    FileUrl = a.FileUrl,
                    FileType = a.FileType,
                    FileName = a.FileName
                }).ToList() ?? new List<MessageAttachment>()
            };

            _context.Messages.Add(message);
            await _context.SaveChangesAsync();
            
            // // Hvis vi skal bare returnere en melding til frontend
            // return new MessageResponseDTO
            // {
            //     Id = message.Id,
            //     SenderId = message.SenderId,
            //     ReceiverId = message.ReceiverId,
            //     GroupName = message.GroupName,
            //     Text = message.Text,
            //     SentAt = message.SentAt,
            //     Attachments = message.Attachments.Select(a => new AttachmentDto
            //     {
            //         FileUrl = a.FileUrl,
            //         FileType = a.FileType,
            //         FileName = a.FileName
            //     }).ToList()
            // };
            // Konverter melding til response (DTO)
            var response = new MessageResponseDTO
            {
                Id = message.Id,
                SenderId = message.SenderId,
                ReceiverId = message.ReceiverId,
                GroupName = message.GroupName,
                Text = message.Text,
                SentAt = message.SentAt,
                Attachments = message.Attachments.Select(a => new AttachmentDto
                {
                    FileUrl = a.FileUrl,
                    FileType = a.FileType,
                    FileName = a.FileName
                }).ToList()
            };

            // 🔥 Send til frontend via SignalR
            if (!string.IsNullOrEmpty(message.GroupName))
            {
                // Hvis det er en gruppe, send til hele gruppen
                await _hubContext.Clients.Group(message.GroupName).SendAsync("ReceiveMessage", response);
            }
            else if (!string.IsNullOrEmpty(message.ReceiverId))
            {
                // Hvis det er privat melding, send til spesifikk bruker
                await _hubContext.Clients.User(message.ReceiverId).SendAsync("ReceiveMessage", response);
            }
            else
            {
                // (Ekstremt sjeldent tilfelle, men fallback hvis begge er null)
                await _hubContext.Clients.All.SendAsync("ReceiveMessage", response);
            }

            return response;
        }

        public async Task<List<MessageResponseDTO>> GetMessagesForUserAsync(string userId)
        {
            // Hent grupper brukeren er medlem av
            var userGroupNames = await _context.GroupMembers
                .Where(gm => gm.UserId == userId)
                .Select(gm => gm.GroupMessage.Name)
                .ToListAsync();

            // Hent private meldinger (1-1)
            var privateMessages = _context.Messages
                .Where(m => m.ReceiverId == userId || m.SenderId == userId);

            // Hent gruppemeldinger hvor brukeren er medlem
            var groupMessages = _context.Messages
                .Where(m => m.GroupName != null && userGroupNames.Contains(m.GroupName));

            // Slå sammen alt
            var allMessages = await privateMessages
                .Union(groupMessages)
                .Include(m => m.Attachments)
                .OrderBy(m => m.SentAt)
                .ToListAsync();

            // Mapper til Response DTO
            return allMessages.Select(m => new MessageResponseDTO
            {
                Id = m.Id,
                SenderId = m.SenderId,
                ReceiverId = m.ReceiverId,
                GroupName = m.GroupName,
                Text = m.Text,
                SentAt = m.SentAt,
                Attachments = m.Attachments.Select(a => new AttachmentDto
                {
                    FileUrl = a.FileUrl,
                    FileType = a.FileType,
                    FileName = a.FileName
                }).ToList()
            }).ToList();
        }
        
        public async Task<List<MessageResponseDTO>> GetMessagesAsync(int skip, int take)
        {
            var messages = await _context.Messages
                .OrderBy(m => m.SentAt)
                .Skip(skip)
                .Take(take)
                .Select(m => new MessageResponseDTO
                {
                    Id = m.Id,
                    SenderId = m.SenderId,
                    ReceiverId = m.ReceiverId,
                    GroupName = m.GroupName,
                    Text = m.Text,
                    SentAt = m.SentAt,
                    Attachments = m.Attachments.Select(a => new AttachmentDto
                    {
                        FileUrl = a.FileUrl,
                        FileType = a.FileType,
                        FileName = a.FileName
                    }).ToList()
                })
                .ToListAsync();

            return messages;
        }
        
    }