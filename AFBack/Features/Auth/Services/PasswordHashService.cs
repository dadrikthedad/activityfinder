using System.Security.Cryptography;
using System.Text;
using AFBack.Features.Auth.Models;
using Konscious.Security.Cryptography;
using Microsoft.AspNetCore.Identity;

namespace AFBack.Features.Auth.Services;

/// <summary>
/// Service som lager et hashet-passord med passordet brukeren velger, samt verifisere et hashet passord.
/// Bruker Argon2 istedenfor BCrypt, da den er enda litt sikrere. Egenskaper for sikkerheten er også i metoden her
/// </summary>
public class PasswordHashService : IPasswordHashService, IPasswordHasher<AppUser>
{
  // Vi lager en tilfeldig bitstreng på 16 bytes(128 bits), kalt salt, som brukes for å kombinere med passordet
  // før det hashes. Det sikrer at alle brukeren får forskjellige hash, selv med like passord.
  // Salt må lagres sammen med passordet da det er ulikt pr bruker
  private const int SaltSize = 16;
  // Her bestemmer vi hvor langt hash-passordet skal være. 32 er en grei balanse mellom sikkerhet og lagrinsplass.
  // 64 tar dobbelt så mye plass, men mye sikrere.
  private const int HashSize = 32;
  // Iterations bestemmer hvor mange ganger vi skal iterere igjennom algoritmen, kun for sikkerhetsskyld.
  // MemorySize bestemmer hvor tungt det skal være for RAM. Sammen gjør de passord-innlogging tregere for innloggede
  // enheter. Grunnen til det er at maskinen som prøver å logge inn bruker mer minne og CPU-tid
  // hver gang de prøver å logge inn, og er en sikkerhet mot angrep.
  private const int Iterations = 4;
  private const int MemorySize = 131072;
  // Parallelism bestemmer antall tråder som kjører samtidig under hashing. Må ikke sette den høyere
  // enn antall CPU-kjerner tilgjengelig. 4-8 på servere er vanlig. Dette har ikke så mye med sikkerheten å gjøre,
  // mest for å speede opp hashingen.
  private const int Parallelism = 4;
  
  public string HashPassword(string password)
  {
      ArgumentException.ThrowIfNullOrWhiteSpace(password);
    
      byte[] salt = GenerateSalt();
      byte[] hash = HashPasswordInternal(password, salt);
    
      // Vi slår sammen salt og hashen for å verifisere senere og kopierer saltet inn og hashen. Slik kan det se ut:
      // [  SALT (16 byters) | HASH (32 bytes)  ]
      byte[] hashBytes = new byte[SaltSize + HashSize];
      Array.Copy(salt, 0, hashBytes, 0, SaltSize);
      Array.Copy(hash, 0, hashBytes, SaltSize, HashSize);
    
      // Returnerer som en Base64-kodet string
      return Convert.ToBase64String(hashBytes);
  }


 
  public bool VerifyPassword(string password, string hash)
  {
      if (string.IsNullOrWhiteSpace(password) || string.IsNullOrWhiteSpace(hash))
          return false;
    
      try
      { 
          // Konvereterer Base64-strengen tilbake til bytes
          byte[] hashBytes = Convert.FromBase64String(hash);
          // Stemmer ikke lengden så er det feil passord
          if (hashBytes.Length != SaltSize + HashSize)
              return false;
        
          // Vi splitter saltet og hashen i to deler igjen
          byte[] salt = new byte[SaltSize];
          byte[] originalHash = new byte[HashSize];
          Array.Copy(hashBytes, 0, salt, 0, SaltSize);
          Array.Copy(hashBytes, SaltSize, originalHash, 0, HashSize);
        
          // Vi hasher passordet igjen for å sjekke at det stemmer med brukerens passord
          byte[] newHash = HashPasswordInternal(password, salt);
        
          // Denne metoden sammenlignerer hashene byte for byte for å sjekke at de er like. Den sammenligner alle
          // bytene før den returnerer resultatet, for å ikke gi noe pekepinne på om brukeren er på rett vei til å
          // gjette til seg riktig passord
          return CryptographicOperations.FixedTimeEquals(originalHash, newHash);
      }
      catch
      {
          return false;
      }
  }


  /// <summary>
  /// Genrerer saltet
  /// </summary>
  /// <returns>Salt</returns>
  private byte[] GenerateSalt() => RandomNumberGenerator.GetBytes(SaltSize);


  /// <summary>
  /// Hasher passordet. Passordet konverteres til bytes og kombineres med saltet. Det er her vi kjører igjennom flere
  /// ganger for å bruke mye minne for ondsinnete brukere
  /// </summary>
  /// <param name="password"></param>
  /// <param name="salt"></param>
  /// <returns>Hashet passord</returns>
  private byte[] HashPasswordInternal(string password, byte[] salt)
  {
      using var argon2 = new Argon2id(Encoding.UTF8.GetBytes(password))
      {
          Salt = salt,
          DegreeOfParallelism = Parallelism,
          MemorySize = MemorySize,
          Iterations = Iterations
      };
      
      return argon2.GetBytes(HashSize);
  }

    
  public string HashPassword(AppUser user, string password) => HashPassword(password);
  
  public PasswordVerificationResult VerifyHashedPassword(AppUser user, string hashedPassword, string providedPassword)
  {
      var isValid = VerifyPassword(providedPassword, hashedPassword);
      return isValid
          ? PasswordVerificationResult.Success
          : PasswordVerificationResult.Failed;
  }
}

