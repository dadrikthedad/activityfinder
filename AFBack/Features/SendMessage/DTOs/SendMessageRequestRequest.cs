using System.ComponentModel.DataAnnotations;

namespace AFBack.Features.SendMessage.DTOs;

public class SendMessageRequestRequest
{
    [Required]
    public int RequestReceiverId { get; set; }
}