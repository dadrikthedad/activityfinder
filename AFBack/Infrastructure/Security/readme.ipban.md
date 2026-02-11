# IP Ban System

## Oversikt

`IpBanService` håndterer IP-basert banning med in-memory cache for rask oppslag og database for persistens. Servicen er registrert som **singleton** fordi den eier to `ConcurrentDictionary`-cacher som må leve mellom requests.

Bruker-banning (lockout) håndteres via ASP.NET Core Identity og trigges automatisk fra `BanIpAsync` når en autentisert bruker bannes.

## Arkitektur

```
Request → IpBanMiddleware → IsIpBannedAsync()
                                ├── Positiv cache (_bannedIpsCache) → bannet
                                ├── Negativ cache (_notBannedIpsCache) → ikke bannet
                                └── Database lookup → oppdater cache
```

## Cache-strategi

Servicen bruker to separate cacher for å minimere database-oppslag:

- **`_bannedIpsCache`** (positiv cache): IP-er som er bannet. Inneholder `CachedIpBan` med bantype, utløpstid og når den ble cachet. Revalideres mot database etter `IpBanConfig.RevalidationInterval`.
- **`_notBannedIpsCache`** (negativ cache): IP-er vi nylig har sjekket og vet ikke er bannet. Utløper etter `IpBanConfig.NegativeCacheDuration`. Forhindrer gjentatte database-oppslag for normale brukere.

## Metoder

### `IsIpBannedAsync(string? ipAddress) → bool`

Sjekker om en IP er bannet. Kalles fra middleware på hver request.

Flyt:
1. Valider og normaliser IP
2. Sjekk whitelist → return false
3. Sjekk positiv cache → utgått? `UnbanIpAsync`. Fersk? return true
4. Sjekk negativ cache → fersk? return false
5. Database lookup → oppdater riktig cache

### `BanIpAsync(string ipAddress, BanType banType, string reason, string? userId, string bannedBy)`

Banner en IP-adresse. Håndterer hele livssyklusen:

- **Ingen eksisterende ban**: Beregner varighet via `CalculateBanDurationAsync`, oppretter ny `IpBan`
- **Eksisterende midlertidig ban**: Oppdaterer bantype, reason og varighet (eskalering mulig)
- **Eksisterende permanent ban**: Ignorerer, logger debug
- **Autentisert bruker**: Setter Identity lockout med samme varighet, revokerer refresh tokens

Permanent ban kan kun settes manuelt (admin). Auto-ban er alltid midlertidig.

### `UnbanIpAsync(string ipAddress)`

Fjerner ban for en IP. Deaktiverer i database, fjerner fra positiv cache, legger til i negativ cache.

### `IsWhitelisted(string ipAddress) → bool`

Sjekker om IP er whitelisted. Støtter enkelt-IP-er og CIDR-ranges fra `IpBanConfig.WhitelistedIps`.

### `ClearExpiredFromCacheAsync()`

Vedlikeholdsmetode som rydder utgåtte bans fra begge cacher og deaktiverer utgåtte bans i database. Bør kalles periodisk fra en `IHostedService`.

## Ban-eskalering

Varighet beregnes automatisk basert på totalt antall `SuspiciousActivity`-rader for IP-en (all-time, ikke bare nylige):

| Suspicious Activities | Varighet |
|---|---|
| < 10 | `BaseBanDuration` × 1 |
| < 20 | `BaseBanDuration` × 4 |
| < 30 | `BaseBanDuration` × 24 |
| 30+ | `BaseBanDuration` × 168 |

Permanent ban settes kun manuelt av admin.

## Konfigurasjon

All konfigurasjon ligger i `IpBanConfig`:

- `BaseBanDuration` — grunntid for midlertidig ban (f.eks. 1 time)
- `BanEscalation` — terskler og multiplikatorer for eskalering
- `WhitelistedIps` — IP-er og CIDR-ranges som aldri bannes
- `NegativeCacheDuration` — hvor lenge negativ cache er gyldig
- `RevalidationInterval` — hvor ofte positiv cache revalideres mot database
- `SuspiciousWindow` — tidsvindu for å telle mistenksomme aktiviteter
- `MaxSuspiciousAttempts` — terskel for auto-ban

## Oppstart

Ved oppstart laster servicen alle aktive bans fra database inn i cache via `LoadActiveBansAsync`. Utgåtte bans deaktiveres automatisk.

## Avhengigheter

- `IIpBanRepository` — database-operasjoner for IP-bans
- `ISuspiciousActivityRepository` — henter antall suspicious activities for eskaleringsberegning
- `UserManager<AppUser>` — Identity lockout ved bruker-ban
