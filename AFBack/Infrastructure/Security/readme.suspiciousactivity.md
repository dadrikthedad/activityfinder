# Suspicious Activity System

## Oversikt

`SuspiciousActivityService` registrerer mistenkelig aktivitet og trigrer automatisk IP-ban når terskelen nås. Servicen er registrert som **scoped** — den har ingen in-memory state og oppretter bare database-entiteter og kaller `IIpBanService`.

## Arkitektur

```
Kallere (RateLimiter, Middleware, etc.)
    │
    ▼
ReportSuspiciousActivityAsync()
    ├── Valider IP, sjekk whitelist
    ├── Sjekk om allerede bannet (rydder opp i cache)
    ├── Koble til UserDevice hvis autentisert
    ├── Lagre SuspiciousActivity i database
    └── Sjekk terskel
         ├── Under terskel → logg warning
         └── Over terskel → IpBanService.BanIpAsync()
                                ├── IP-ban (med eskalerende varighet)
                                ├── Identity lockout (hvis autentisert)
                                └── Revoke refresh tokens
```

## Metode

### `ReportSuspiciousActivityAsync(...)`

Parametere:

| Parameter | Type | Beskrivelse |
|---|---|---|
| `ipAddress` | `string` | IP-adressen til forespørselen |
| `activityType` | `SuspiciousActivityType` | Type handling (RateLimitExceeded, etc.) |
| `reason` | `string` | Detaljer om årsaken |
| `deviceFingerprint` | `string?` | Device fingerprint for device-oppslag |
| `userId` | `string?` | Bruker-ID hvis autentisert |
| `userAgent` | `string?` | Nettleserens User-Agent |
| `endpoint` | `string?` | Endepunktet som ble brukt |

Flyt:
1. Normaliser og valider IP
2. Sjekk whitelist → return
3. Sjekk om IP allerede er bannet → return (dette rydder også opp i utgåtte bans via cache)
4. Slå opp `UserDevice` hvis `userId` og `deviceFingerprint` er tilgjengelig
5. Opprett og lagre `SuspiciousActivity`
6. Tell nylige aktiviteter innenfor `SuspiciousWindow`
7. Hvis terskel nådd → `BanIpAsync` med `userId` for synkronisert IP-ban og lockout

## Datamodell

```csharp
public class SuspiciousActivity
{
    public int Id { get; set; }
    public string? UserId { get; set; }          // Nullable — uautentiserte har ikke bruker
    public int? UserDeviceId { get; set; }        // Nullable — kun hvis fingerprint matcher
    public string IpAddress { get; set; }         // Alltid tilgjengelig
    public string? UserAgent { get; set; }
    public SuspiciousActivityType ActivityType { get; set; }
    public string Reason { get; set; }
    public DateTime Timestamp { get; set; }
    public string? Endpoint { get; set; }
}
```

Tre nivåer av sporing:
- **Nivå 1** (alltid): IP-adresse, aktivitetstype, reason, timestamp, endpoint
- **Nivå 2** (hvis fingerprint): UserDeviceId
- **Nivå 3** (hvis innlogget): UserId

## Rolle i eskalering

`SuspiciousActivity`-tabellen har en dobbel rolle:

1. **Trigger for auto-ban**: Antall nylige rader innenfor `SuspiciousWindow` sammenlignes med `MaxSuspiciousAttempts`
2. **Input for ban-eskalering**: Totalt antall rader (all-time) brukes av `CalculateBanDurationAsync` i `IpBanService` for å bestemme ban-varighet. Flere aktiviteter = lengre ban.

Rader slettes aldri — selv etter at en midlertidig ban utløper, husker systemet historikken og gir strengere straff neste gang.

## Kallere

Systemet er designet for å ta imot rapporter fra flere kilder:

- **Rate Limiter** — `HandleRateLimitRejection` rapporterer `SuspiciousActivityType.RateLimitExceeded` etter nok strikes
- **Fremtidige kilder** — andre middleware eller services kan rapportere andre typer (brute force, spam, etc.)

## Konfigurasjon

Relevante verdier fra `IpBanConfig`:

- `SuspiciousWindow` — tidsvindu for å telle nylige aktiviteter
- `MaxSuspiciousAttempts` — terskel for auto-ban innenfor vinduet

## Avhengigheter

- `IIpBanService` — sjekker om IP er bannet, utfører banning
- `ISuspiciousActivityRepository` — lagrer aktiviteter, teller nylige
- `IUserDeviceRepository` — slår opp device fra fingerprint
