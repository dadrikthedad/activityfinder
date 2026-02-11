using System.ComponentModel.DataAnnotations;

namespace AFBack.Features.Auth.Models;

/// <summary>
/// Lagrer verifiseringskoder og tokens for e-post og passord-reset.
/// Identity håndterer tokens (lange, for lenker), denne håndterer koder (6-sifrede, for app).
/// Brukes ved signup, resend verification, passord-reset, og senere ved endring av e-post/telefon.
/// </summary>
public class VerificationInfo
{
    // ======================== Primærnøkkel (1:1 med AppUser) ========================
    
    /// <summary>
    /// Bruker UserId som primærnøkkel for å sikre one-to-one relasjon med AppUser.
    /// </summary>
    [MaxLength(100)]
    public string UserId { get; set; } = null!;
    
    // ======================== E-post verifisering ========================
    
    /// <summary>
    /// 6-sifret kode for verifisering i appen og web
    /// </summary>
    [MaxLength(6)]
    public string? EmailConfirmationCode { get; set; }
    
    public DateTime? EmailCodeExpiresAt { get; set; }
    
    /// <summary>
    /// Antall feilede forsøk på å taste inn verifiseringskode.
    /// Nullstilles ved ny kode eller vellykket verifisering.
    /// </summary>
    public int EmailCodeFailedAttempts { get; set; }
    
    public DateTime? LastVerificationEmailSentAt { get; set; }
    
    // ======================== Passord reset ========================
    
    /// <summary>
    /// 6-sifret kode for passord-reset i appen.
    /// Identity sin token brukes for lenke-reset på web.
    /// </summary>
    [MaxLength(6)]
    public string? PasswordResetCode { get; set; }
    
    public DateTime? PasswordResetCodeExpiresAt { get; set; }
    
    /// <summary>
    /// Antall feilede forsøk på å taste inn reset-kode.
    /// Nullstilles ved ny kode eller vellykket reset.
    /// </summary>
    public int PasswordResetCodeFailedAttempts { get; set; }
    
    public DateTime? LastPasswordResetEmailSentAt { get; set; }
    
    // ======================== Telefon verifisering ========================

    /// <summary>
    /// 6-sifret kode for telefon-verifisering via SMS.
    /// </summary>
    [MaxLength(6)]
    public string? PhoneVerificationCode { get; set; }

    public DateTime? PhoneCodeExpiresAt { get; set; }

    /// <summary>
    /// Antall feilede forsøk på å taste inn SMS-kode.
    /// Nullstilles ved ny kode eller vellykket verifisering.
    /// </summary>
    public int PhoneCodeFailedAttempts { get; set; }

    public DateTime? LastVerificationSmsSentAt { get; set; }
    
    // ======================== Navigasjonsegenskaper ========================
    public AppUser AppUser { get; set; } = null!;
}
