using System.ComponentModel.DataAnnotations.Schema;

namespace AFBack.Models;
using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;
// 10.03
// All informasjon om bruker registering og egenskaper som blir lagret til bruker og database.
// Selve user klassen som er en database-modell som blir lagret til databasen.
public class User
{   
    // Id som øker med en for hver gang en ny blir laget, og primærnøkkkel
    public int Id { get; set; }
    
    [Required]
    [MaxLength(50)]
    public string FirstName { get; set; } = null!;
    [MaxLength(50)]
    public string? MiddleName { get; set; }
    [Required]
    [MaxLength(50)]
    public string LastName { get; set; } = null!;
    
    // Kan hente hele navnet med FullName hvis det trengs, blir ikke lagret til databasen.
    [Required]
    [MaxLength(150)]
    public string FullName { get; set; } = string.Empty;
    
    // Oppdatere fultnavn
    public void UpdateFullName()
    {
        FullName = $"{FirstName} {(string.IsNullOrWhiteSpace(MiddleName) ? "" : MiddleName + " ")}{LastName}"
            .Replace("  ", " ")
            .Trim();
    }
    public DateTime DateOfBirth { get; set; }
    
    // Henter alderen, trenger ikke da å lagre alderen når vi har fødseldag
    [NotMapped]
    public int? Age
    {
        get
        {
            if (DateOfBirth == null)
                return null;

            var today = DateTime.Today;
            var age = today.Year - DateOfBirth.Year;

            // Justerer ned om brukeren ikke har hatt bursdag enda i år
            if (DateOfBirth.Date > today.AddYears(-age))
                age--;

            return age;
        }
    }
    
    [Required]
    [EmailAddress]
    [MaxLength(100)]
    // Epost som kreves for å opprette en bruker
    public string Email { get; set; } = null!;
    
    // Telefon, ikke krav på
    [MaxLength(30)]
    public string? Phone { get; set; }
    
    // JsonIgnore for å ikke eksponere passordet og returnere sensitiv data.
    [JsonIgnore]
    public string PasswordHash { get; set; } = null!;
    
    // Opprettelse dato
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    
    // Rolle, minste rolle er User
    public string Role { get; set; } = "User";
    
    // Bool for å sjekke om epost er bekrefted samt en variabel for bekretelsen som må stemme.
    public bool EmailConfirmed { get; set; } = false;
    public string? EmailConfirmationToken { get; set; }
    
    // Lagrer landet
    [Required]
    [MaxLength(100)]
    public string Country { get; set; } = null!;
    
    [MaxLength(100)]
    // Kun null hvis det er et land uten regioner
    public string? Region { get; set; }
    
    [MaxLength(25)]
    public string? PostalCode { get; set; }
    
    // Dropdown meny for med valg av kjønn
    [Column(TypeName= "varchar(20)")]
    [EnumDataType(typeof(Gender))]
    public Gender? Gender { get; set; }
    
    // Her lagrer vi profilen som blir opprettet når brukeren blir laget
    public Profile? Profile { get; set; }
    //Her lagrer vi innstillingene som blir opprettet når brukeren blir laget
    public UserSettings? Settings { get; set; }
    // Sist innlogget
    public DateTime? LastSeen { get; set; }
    
    // Bruker kan velge å ha synlig lokalasjon. Brukes for å hente kartet til brukeren
    // Lokasjonsdata basert på IP ved siste innlogging
    [MaxLength(45)]
    public string? LastLoginIp { get; set; }

    [MaxLength(100)]
    public string? LastLoginCity { get; set; }

    [MaxLength(100)]
    public string? LastLoginRegion { get; set; }

    [MaxLength(100)]
    public string? LastLoginCountry { get; set; }
    
    public bool IsOnline => LastSeen.HasValue && (DateTime.UtcNow - LastSeen.Value).TotalMinutes < 5;
    
    // Metode for å verifisere passord laget 11.03. Sjekker om passordet er korrekt når brukeren taster den inn.
    public bool VerifyPassword(string password) => BCrypt.Net.BCrypt.Verify(password, PasswordHash);
    
    [NotMapped]
    public ICollection<CanSend> CanSendTo { get; set; } = new List<CanSend>();
    
    public ICollection<UserOnlineStatus> OnlineStatuses { get; set; } = new List<UserOnlineStatus>();
}

public enum Gender
{
    Male,
    Female,
    Unspecified
}

