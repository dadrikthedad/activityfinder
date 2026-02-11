# EmailRateLimitService

Kontrollerer hvor mange e-poster som kan sendes per adresse og IP.  
Beskytter mot kostnadsangrep (SES/SendGrid) og spam.

## Tre nivåer

| Nivå | Nøkkel | Grense | Formål |
|------|--------|--------|--------|
| IP-grense | IP-adresse | 10/time (delt) | Stopper angrep med mange forskjellige adresser |
| Cooldown | EmailType:adresse | 2 min | Hindrer utålmodig gjentatt klikking |
| Daglig grense | EmailType:adresse | 5 verifikasjon, 3 passord-reset | Begrenser kostnad per adresse |

**Rekkefølge:** IP → Cooldown → Daglig. Billigste sjekk først.

## E-posttyper

Verification og PasswordReset har separate tellere for cooldown og daglig grense.  
IP-grensen er delt — en angriper kan ikke omgå den ved å veksle mellom typer.

## Lagring

In-memory med `ConcurrentDictionary` (singleton). Ingen database.

| Dictionary | Key | Value | Formål |
|------------|-----|-------|--------|
| `_lastSentTimestamps` | `{Type}:{email}` | `DateTime` | Cooldown-sjekk |
| `_dailySendHistory` | `{Type}:{email}` | `List<DateTime>` | Daglig telling |
| `_ipSendHistory` | IP-adresse | `List<DateTime>` | IP-telling |

**Tap ved restart er akseptabelt** — verste fall får noen sende én ekstra e-post.

## Thread-safety

- `ConcurrentDictionary` for trygg tilgang til ordbøkene
- `Lazy<List<DateTime>>` sikrer at listen opprettes nøyaktig én gang per nøkkel
- `lock` på hver `List<DateTime>` før lesing/skriving

## Cleanup

Håndteres av `EmailRateLimitCleanupTask` via `MaintenanceCleanupService`.  
Servicen har ingen egen `Timer` eller `IDisposable`.

`PerformCleanup()` rydder:
- Utløpte cooldowns fra `_lastSentTimestamps`
- Entries eldre enn 24t fra `_dailySendHistory`
- Entries eldre enn 60 min fra `_ipSendHistory`
- Tomme nøkler fjernes fra ordbøkene for å spare minne

## Bruk

```csharp
// Sjekk om sending er tillatt
var result = emailRateLimitService.CanSendEmail(EmailType.Verification, email, ip);
if (!result.IsSuccess)
    return result.ToProblemDetails();

// Send e-post...

// Registrer vellykket sending
emailRateLimitService.RegisterEmailSent(EmailType.Verification, email, ip);

// Ved vellykket verifisering — fjern cooldown
emailRateLimitService.ClearEmailAttempts(EmailType.Verification, email);
```

## Konfigurasjon

Verdier i `RateLimitConfig` (statisk klasse):

| Innstilling | Standardverdi |
|-------------|---------------|
| `VerificationCooldownMinutes` | 2 |
| `MaxVerificationEmailsPerDay` | 5 |
| `PasswordResetCooldownMinutes` | 2 |
| `MaxPasswordResetEmailsPerDay` | 3 |
| `MaxEmailsPerIpPerHour` | 10 |
| `EmailIpWindowMinutes` | 60 |
| `EmailDayWindowHours` | 24 |
| `EmailCleanupIntervalMinutes` | 30 |

## Filer

```
Infrastructure/Security/
  RateLimiting/
    IEmailRateLimitService.cs
    EmailRateLimitService.cs
Infrastructure/Cleanup/
  Tasks/
    EmailRateLimitCleanupTask.cs
Configurations/
  Enums/EmailType.cs
  Options/RateLimitConfig.cs
```

## Registrering

```csharp
services.AddSingleton<IEmailRateLimitService, EmailRateLimitService>();
services.AddSingleton<ICleanupTask, EmailRateLimitCleanupTask>();
```
