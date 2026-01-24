using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;
using AFBack.Features.CanSend.Models;
using AFBack.Features.Conversation.Models;
using AFBack.Models.Conversation;
using AFBack.Models.Crypto;
using AFBack.Models.User;

namespace AFBack.Models.Auth;

public class AppUser
{   
    // ======================== PRIMÆRNØKKEL ========================
    [Key]
    [MaxLength(100)]
    public string Id { get; init; } = Guid.NewGuid().ToString();
    
    // ======================== Autentikasjon ========================
    
    [Required]
    [EmailAddress]
    [MaxLength(100)]
    public string Email { get; set; } = null!;
    
    public bool EmailConfirmed { get; set; }
    
    // Telefon, ikke krav på
    [MaxLength(30)]
    public string? Phone { get; set; }
    
    [JsonIgnore]
    [MaxLength(250)]
    public string PasswordHash { get; set; } = null!;
    
    [Required]
    [MaxLength(50)]
    public string Role { get; set; } = "AppUser";
    
    // TODO: Skal byttes ut med JwtService når jeg får imporertert den
    
    // ======================== Navn og profilbilde ========================
    
    [Required]
    [MaxLength(75)]
    public string FirstName { get; set; } = null!;

    [Required]
    [MaxLength(75)]
    public string LastName { get; set; } = null!;
    
    [Required]
    [MaxLength(150)]
    public string FullName { get; set; } = string.Empty;
    
    [MaxLength(500)]
    public string? ProfileImageUrl { get; set; }
    
    // ======================== Metoder ========================
    
    public bool VerifyPassword(string password) => BCrypt.Net.BCrypt.Verify(password, PasswordHash);
    
    public void UpdateFullName()
    {
        FullName = $"{FirstName} {LastName}".Trim();
    }

    
    // ======================== Metadata  ========================
    public DateTime CreatedAt { get; init; } = DateTime.UtcNow;
    
    public DateTime? OnBoardingCompletedAt { get; set; }
    
    // ======================== Navigasjonsegenskaper ========================
    public required UserProfile UserProfile { get; set; }
    public UserSettings? UserSettings { get; set; }
    public ICollection<UserDevice> Devices { get; set; } = new List<UserDevice>();
    public ICollection<UserConnection> Connections { get; set; } = new List<UserConnection>();
    public ICollection<LoginHistory> LoginHistory { get; set; } = new List<LoginHistory>();
    public ICollection<BanInfo> Bans { get; set; } = new List<BanInfo>();
    public ICollection<SuspiciousActivity> SuspiciousActivities { get; set; } = new List<SuspiciousActivity>();
    
    public ICollection<RefreshToken> RefreshTokens { get; set; } = new List<RefreshToken>();

    public VerificationInfo? VerificationInfo { get; set; }
    
    public ICollection<UserPublicKey> PublicKeys { get; set; } = new List<UserPublicKey>();
    public ICollection<CanSend> CanSendTo { get; set; } = new List<CanSend>();
    
    public ICollection<ConversationParticipant> ConversationParticipants { get; set; } 
        = new List<ConversationParticipant>();
}



