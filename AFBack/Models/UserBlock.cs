using System.ComponentModel.DataAnnotations;
using AFBack.Models.Auth;
using Microsoft.EntityFrameworkCore;

namespace AFBack.Models;

[PrimaryKey(nameof(BlockerId), nameof(BlockedUserId))]
public class UserBlock
{
    // ======================== PRIMÆRNØKKEL ========================
    [Required, MaxLength(100)]
    public string BlockerId { get; set; } = string.Empty; // Brukeren som blokkerer

    [Required, MaxLength(100)] 
    public string BlockedUserId { get; set; } = string.Empty; // Brukeren som blir blokkert
    // ======================== Blocking data ========================
    public DateTime BlockedAt { get; set; } = DateTime.UtcNow;
    // ======================== Navigasjonsegenskaper ========================
    public AppUser Blocker { get; set; } = null!;
    public AppUser BlockedAppUser { get; set; } = null!;
}
