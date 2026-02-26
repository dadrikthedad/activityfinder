using System.ComponentModel.DataAnnotations;
using AFBack.Features.Conversation.Models;
using AFBack.Features.Messaging.Models;
using AFBack.Features.Profile.Models;
using AFBack.Features.Settings.Models;
using AFBack.Features.SignalR.Models;
using AFBack.Infrastructure.Security.Models;
using Microsoft.AspNetCore.Identity;

namespace AFBack.Features.Auth.Models;

public class AppUser : IdentityUser
{   
    
    // IdentityUser egenskaper:
    // - Id (string)
    // - UserName (string)
    // - Email (string)
    // - EmailConfirmed (bool)
    // - PasswordHash (string)
    // - PhoneNumber (string)
    // - PhoneNumberConfirmed (bool)
    // - TwoFactorEnabled (bool)
    // - LockoutEnd (DateTimeOffset?)
    // - LockoutEnabled (bool)
    // - AccessFailedCount (int)
    
    
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
    
    
    
    // ======================== Metadata  ========================
    public DateTime CreatedAt { get; init; } = DateTime.UtcNow;
    
    public DateTime? OnBoardingCompletedAt { get; set; }
    
    // ======================== Metoder ========================
    public bool IsVerified => EmailConfirmed && PhoneNumberConfirmed;
    
    // ======================== Navigasjonsegenskaper ========================
    public UserProfile? UserProfile { get; set; }
    public UserSettings? UserSettings { get; set; }
    public ICollection<UserDevice> Devices { get; set; } = new List<UserDevice>();
    public ICollection<UserConnection> Connections { get; set; } = new List<UserConnection>();
    public ICollection<LoginHistory> LoginHistory { get; set; } = new List<LoginHistory>();
    public ICollection<SuspiciousActivity> SuspiciousActivities { get; set; } = new List<SuspiciousActivity>();
    
    public ICollection<RefreshToken> RefreshTokens { get; set; } = new List<RefreshToken>();
    
    public ICollection<UserPublicKey> PublicKeys { get; set; } = new List<UserPublicKey>();
    public ICollection<CanSend.Models.CanSend> CanSendTo { get; set; } = new List<CanSend.Models.CanSend>();
    
    public ICollection<ConversationParticipant> ConversationParticipants { get; set; } 
        = new List<ConversationParticipant>();
    
    public VerificationInfo? VerificationInfo { get; set; }
}



