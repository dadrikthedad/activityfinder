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
    
    // ======================== Passord reset ========================
    
    /// <summary>
    /// 6-sifret kode for passord-reset i appen.
    /// Identity sin token brukes for lenke-reset på web.
    /// </summary>
    [MaxLength(6)]
    public string? EmailPasswordResetCode { get; set; }
    
    public DateTime? EmailPasswordResetCodeExpiresAt { get; set; }
    
    /// <summary>
    /// Antall feilede forsøk på å taste inn reset-kode.
    /// Nullstilles ved ny kode eller vellykket reset.
    /// </summary>
    public int EmailPasswordResetCodeFailedAttempts { get; set; }
    
    public DateTime? LastEmailPasswordResetSentAt { get; set; }
    
    /// <summary>
    /// Settes til true når e-postkoden er verifisert i steg 1.
    /// Kreves for å tillate steg 2 (SMS) og steg 3 (nytt passord).
    /// Nullstilles etter fullført reset.
    /// </summary>
    public bool EmailPasswordResetVerified { get; set; }
    
    // ======================== Passord reset — SMS (steg 2) ========================

    /// <summary>
    /// 6-sifret SMS-kode for andre steg i passord-reset.
    /// Genereres kun etter at e-postkoden er verifisert.
    /// </summary>
    [MaxLength(6)]
    public string? SmsPasswordResetCode { get; set; }

    public DateTime? SmsPasswordResetCodeExpiresAt { get; set; }
    
    /// <summary>
    /// Antall feilede forsøk på å taste inn reset-kode.
    /// Nullstilles ved ny kode eller vellykket reset.
    /// </summary>
    public int SmsPasswordResetCodeFailedAttempts  { get; set; }

    public DateTime? LastSmsPasswordResetSentAt { get; set; }
    
    
    /// <summary>
    /// Settes til true når e-postkoden er verifisert i steg 2.
    /// Kreves for å tillate steg 3 (nytt passord).
    /// Nullstilles etter fullført reset.
    /// </summary>
    public bool SmsPasswordResetVerified { get; set; }
    
    // ======================== Bytte e-post — Steg 1: Verifisering av nåværende epost ========================
    
    /// <summary>
    /// Ny epostadresse som brukeren ønsker å bytte til.
    /// Lagres midlertidig mens brukeren verifiserer begge epostadressene.
    /// Nullstilles etter vellykket bytte, utløpt kode, eller ved security alert.
    /// </summary>
    [MaxLength(256)]
    public string? PendingEmail { get; set; }
    
    /// <summary>
    /// Lagrer brukerens forrige epostadresse etter et vellykket epost-bytte.
    /// Brukes av ReportUnauthorizedChangeAsync for å rulle tilbake eposten
    /// og sende reset-epost til riktig adresse selv etter at eposten er byttet.
    /// </summary>
    [MaxLength(256)]
    public string? PreviousEmail { get; set; }

    /// <summary>
    /// Settes til true når nåværende epost er verifisert i steg 1 av epost-bytte.
    /// Kreves for å tillate steg 2 (verifisering av ny epost).
    /// Nullstilles etter fullført bytte eller ved security alert.
    /// </summary>
    public bool CurrentEmailChangeVerified { get; set; }
    
    /// <summary>
    /// 6-sifret kode sendt til NÅVÆRENDE epostadresse for å bekrefte epost-bytte (steg 1).
    /// </summary>
    [MaxLength(6)]
    public string? OldEmailChangeCode { get; set; }

    public DateTime? OldEmailChangeCodeExpiresAt { get; set; }

    public int OldEmailChangeCodeFailedAttempts { get; set; }

    public DateTime? LastOldEmailChangeSentAt { get; set; }

    // ======================== Bytte e-post — Steg 2: Verifisering av ny epost ========================

    /// <summary>
    /// 6-sifret kode sendt til den NYE epostadressen for verifisering (steg 2).
    /// </summary>
    [MaxLength(6)]
    public string? NewEmailChangeCode { get; set; }

    public DateTime? NewEmailChangeCodeExpiresAt { get; set; }

    public int NewEmailChangeCodeFailedAttempts { get; set; }

    public DateTime? LastNewEmailChangeSentAt { get; set; }

    // ======================== Bytte telefonnummer — Steg 1: Verifisering via epost ========================

    /// <summary>
    /// Nytt telefonnummer som brukeren ønsker å bytte til.
    /// Lagres midlertidig mens brukeren verifiserer via epost og SMS.
    /// Nullstilles etter vellykket bytte, utløpt kode, eller ved security alert.
    /// </summary>
    [MaxLength(20)]
    public string? PendingPhoneNumber { get; set; }

    /// <summary>
    /// Lagrer brukerens forrige telefonnummer etter et vellykket telefon-bytte.
    /// Brukes av ReportUnauthorizedChangeAsync for å rulle tilbake nummeret
    /// og sende reset til riktig adresse selv etter at nummeret er byttet.
    /// </summary>
    [MaxLength(20)]
    public string? PreviousPhoneNumber { get; set; }

    /// <summary>
    /// Settes til true når epost-koden er verifisert i steg 1 av telefon-bytte.
    /// Kreves for å tillate steg 2 (SMS-verifisering av nytt nummer).
    /// Nullstilles etter fullført bytte eller ved security alert.
    /// </summary>
    public bool CurrentPhoneChangeVerified { get; set; }

    /// <summary>
    /// 6-sifret kode sendt til brukerens EPOST for å bekrefte telefon-bytte (steg 1).
    /// </summary>
    [MaxLength(6)]
    public string? PhoneChangeEmailCode { get; set; }

    public DateTime? PhoneChangeEmailCodeExpiresAt { get; set; }

    public int PhoneChangeEmailCodeFailedAttempts { get; set; }

    public DateTime? LastPhoneChangeEmailSentAt { get; set; }

// ======================== Bytte telefonnummer — Steg 2: Verifisering av nytt nummer ========================

    /// <summary>
    /// 6-sifret SMS-kode sendt til det NYE telefonnummeret for verifisering (steg 2).
    /// </summary>
    [MaxLength(6)]
    public string? NewPhoneChangeCode { get; set; }

    public DateTime? NewPhoneChangeCodeExpiresAt { get; set; }

    public int NewPhoneChangeCodeFailedAttempts { get; set; }

    public DateTime? LastNewPhoneChangeSentAt { get; set; }
    
    
    
    // ======================== Sikkerhetsvarsling ========================

    /// <summary>
    /// Engangs-token for "This wasn't me"-lenke i sikkerhetsvarsler.
    /// Genereres når bruker ber om å bytte epost eller telefon.
    /// Brukes for å låse kontoen og nullstille endringer uten autentisering.
    /// </summary>
    [MaxLength(64)]
    public string? SecurityAlertToken { get; set; }

    public DateTime? SecurityAlertTokenExpiresAt { get; set; }
    
    
    // ======================== Navigasjonsegenskaper ========================
    public AppUser AppUser { get; set; } = null!;
}
