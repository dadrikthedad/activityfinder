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
    public string FullName => $"{FirstName} {MiddleName?.Trim()} {LastName}".Replace("  ", " ").Trim();
    public DateTime DateOfBirth { get; set; }
    
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
    
    [Required]
    [MaxLength(100)]
    public string Country { get; set; } = null!;
    
    [Required]
    [MaxLength(100)]
    // Kun null hvis det er et land uten regioner
    public string? Region { get; set; }
    
    [MaxLength(25)]
    public string? PostalCode { get; set; }
    
    // Lagrer landet
    
    // Metode for å verifisere passord laget 11.03. Sjekker om passordet er korrekt når brukeren taster den inn.
    public bool VerifyPassword(string password) => BCrypt.Net.BCrypt.Verify(password, PasswordHash);
    
}