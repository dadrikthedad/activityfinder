namespace AFBack.DTOs;
using System.ComponentModel.DataAnnotations;
using CountryData.Standard;

// Denne klassen brukes kun til å ta imot data når en bruker registerer seg. Blir ikke lagret direkte i databasen, vi konverterer den til User først.
// Så henter fra FrontEnd, og inneholder Required-attributter og andre attributter for å validere input at det er ritkig før lagring
public class UserRegisterDTO
{   
    
    //Required krever at dette at feltet skal fylles inn og gir feilmelding vi har presisert i ErrorMessage hvis ikkke.
    [Required(ErrorMessage = "First name is required.")]
    [MaxLength(50, ErrorMessage = "First name can't be more than 50 characters.")]
    public string FirstName { get; set; } = null!;
    
    // Anbefales at den er = string.Empty etter gettern og settern. Vi får se, jeg tror jeg ønsker det som null verdi.
    [MaxLength(50,  ErrorMessage = "Middle name can't be more than 50 characters.")]
    public string? MiddleName { get; set; }
    
    [Required(ErrorMessage = "Last name is required.")]
    [MaxLength(50, ErrorMessage = "Last name can't be more than 50 characters.")]
    public string LastName { get; set; } = null!;
    
    [Required(ErrorMessage = "Date of birth is required.")]
    public DateTime DateOfBirth { get; set; }
    
    private string _email = null!;
    // Fjerner mellomrom før og etter med trim
    
    [Required(ErrorMessage = "Valid email is required.")]
    [EmailAddress(ErrorMessage = "Invalid email format.")]
    [MaxLength(100, ErrorMessage = "Email can't be more than 100 characters.")]
    public string Email 
    {
        get => _email;
        set => _email = value.Trim();
    }
    
    private string? _phone;
    
    [Phone(ErrorMessage = "Invalid phone number format.")]
    [MaxLength(30, ErrorMessage = "Phone number can't be more than 30 characters.")]
    public string? Phone
    {
        get => _phone;
        set => _phone = value?.Trim();
    }
    
    // Passord Må være med og har en min lengde på 8 og maks lengde på 128 og RegularExpression sjekkekr at det en stor og liten bokstav, samt et nummer.
    // Blir laget som et kryptert passord.
    [Required(ErrorMessage = "Password is required.")]
    [MinLength(8, ErrorMessage = "Password must be at least 8 character long.")]
    [MaxLength(128, ErrorMessage = "Password must be maximum 128 characters long.")]
    [RegularExpression(@"^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,128}$", ErrorMessage = "Password must contain at least one lowercase letter, uppercase letter and one number.")]
    public string Password { get; set; } = null!;
    
    // Lagrer en liste med alle land for å sammenligne mot country.
    private static readonly HashSet<string> _validCountries;
    
    public string _country = null!;
    
    [Required(ErrorMessage = "Must be a valid country.")]
    [MaxLength(100, ErrorMessage = "Country can't be more than 100 characters.")]
    public string Country
    {
        get => _country;
        set
        {
            if (!_validCountries.Contains(value))
                throw new ValidationException("Invalid country.");
            _country = value;
        }
    }
    
    // TODO: Kan fjerne MaxLength etterhvert når vi får satt inn droppdown menyen.
    [Required(ErrorMessage = "Must be a valid providence.")]
    [MaxLength(100, ErrorMessage = "Providence can't be more than 100 characters.")]
    public string Region { get; set; } = null!;
    
    [MaxLength(25, ErrorMessage = "Postal code can't be more than 25 characters.")]
    public string? PostalCode { get; set; }
    
    // Lagd en statisk konstruktør som oppretter en liste med alle land ved å bruke CountryHelper sin GetCountries()
    static UserRegisterDTO()
    {
        var countryHelper = new CountryHelper();
        _validCountries = new HashSet<string>(countryHelper.GetCountries());
    }
    
}