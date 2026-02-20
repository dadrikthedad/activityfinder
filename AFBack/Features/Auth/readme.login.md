# Login, Token Management & Session Handling

Detaljert dokumentasjon av innlogging, token-generering, token-fornyelse, utlogging og sesjons-sikkerhet.
For oversikt over hele Auth-featurem, se `readme.auth.md`.

## Arkitektur-oversikt

```
┌────────────────────────────────────────────────────────────────┐
│  Klient (Web / Mobil)                                          │
│                                                                │
│  Lagrer: AccessToken, RefreshToken, DeviceFingerprint          │
└──────────────────────────┬─────────────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────────────┐
│  ASP.NET Core Pipeline                                         │
│                                                                │
│  1. Rate Limiting (Auth policy)                                │
│  2. IP Ban Middleware                                           │
│  3. JWT-validering (ConfigureJwtBearerOptions)                 │
│  4. Token Blacklist Middleware (Redis-sjekk)                    │
│  5. Authorization                                              │
│  6. Controller → Service → Repository                          │
└────────────────────────────────────────────────────────────────┘
```

## Token-modell

| Token | Type | Levetid | Lagring | Formål |
|-------|------|---------|---------|--------|
| Access Token | JWT (HS256) | 15 min | Kun klient | Autentisering av API-kall |
| Refresh Token | Opak (64 bytes, Base64) | 365 dager | PostgreSQL + klient | Fornye access token uten ny innlogging |

### Hvorfor denne modellen?

Meldingsapper (WhatsApp, Signal, Telegram) logger inn brukeren én gang per enhet.
Brukeren forblir innlogget til de eksplisitt logger ut eller blir tvunget ut.

- Offline i 3 uker → åpne appen → access token utløpt → refresh → alt fungerer
- Offline i 12+ måneder → refresh token utløpt → må logge inn på nytt

Access token er kort (15 min) for å begrense skadeomfang ved kompromittering.
Refresh token er lang (12 måneder) for at brukerne slipper å logge inn hele tiden.

### JWT Claims

| Claim | Verdi | Beskrivelse |
|-------|-------|-------------|
| `sub` | UserId | Brukerens unike ID |
| `email` | Brukerens epost | Epostadresse |
| `jti` | GUID | Unik token-ID, brukes for Redis blacklisting |
| `device_id` | DeviceId (int) | Enheten tokenet er utstedt for |
| `role` | Rollenavn | Brukerens roller (User, Admin, etc.) |
| `exp` | Unix timestamp | Utløpstidspunkt |

#### Claim-mapping

Den automatiske claim-mappingen fra SOAP/WS-Federation-æraen er slått av via
`JsonWebTokenHandler.DefaultInboundClaimTypeMap.Clear()`. Det betyr at claim-navnene
i tokenet er identiske med det som leses i koden — ingen skjult oversettelse fra
`sub` → `ClaimTypes.NameIdentifier`.

`ConfigureJwtBearerOptions` setter `RoleClaimType = "role"` og
`NameClaimType = JwtRegisteredClaimNames.Sub` for at `[Authorize(Roles = "...")]`
og `User.Identity.Name` fungerer korrekt uten mappingen.

### Konfigurasjon (TokenConfig.cs)

| Verdi | Konstant | Beskrivelse |
|-------|----------|-------------|
| 15 min | `AccessTokenMinutes` | Access token levetid |
| 365 dager | `RefreshTokenDays` | Refresh token levetid |
| 64 bytes | `RefreshTokenSizeBytes` | Entropi for refresh token (86 tegn i Base64) |
| 30 sek | `ClockSkewSeconds` | Toleranse for klokkeforskjeller mellom servere. Brukes i JWT-validering og som buffer i Redis blacklist TTL |

## Flytdiagrammer

### Login

```
POST /api/auth/login
Body: { Email, Password, Device: { DeviceFingerprint, DeviceName, ... } }

  1. Rate limit-sjekk (Auth policy)
  2. Finn bruker (eller bruk DummyUser for timing-beskyttelse)
  3. Lockout-sjekk via Identity
  4. Passord-validering (Argon2id)
     ├─ Feil → AccessFailedAsync (teller opp)
     │         ├─ Lockout nådd → SuspiciousActivity-rapportering
     │         └─ Returner "Wrong email or password"
     └─ Riktig ↓
  5. Epost-verifisering-sjekk
     └─ Ikke verifisert → Sender ny verifiseringsepost via IAccountVerificationService
  6. Telefon-verifisering-sjekk
     └─ Ikke verifisert → Sender ny verifiserings-SMS via IAccountVerificationService
  7. Nullstill failed attempts
  8. Resolve/opprett UserDevice
  9. Generer token-par (AccessToken + RefreshToken)
 10. Logg LoginHistory
 11. Returner LoginResponse
```

### Token Refresh (Rotation)

```
POST /api/token/refresh
Body: { RefreshToken, DeviceFingerprint }

  1. Finn refresh token i DB (inkl. UserDevice og AppUser)
  2. Sjekk om revokert
     └─ Ja → TOKEN REUSE DETECTION
        Revoker ALLE tokens for brukeren (mulig token-tyveri)
        Returner feil
  3. Sjekk utløp
     └─ Utløpt → Returner feil, brukeren må logge inn på nytt
  4. Sjekk device fingerprint
     └─ Mismatch → Returner feil (token brukt fra feil enhet)
  5. Revoker gammelt refresh token ("Rotated during refresh")
  6. Generer nytt token-par
  7. Oppdater device metadata (LastUsedAt, LastIpAddress)
  8. Returner nytt LoginResponse
```

### Logout (én enhet)

```
POST /api/auth/logout
Body: { RefreshToken }
Headers: Authorization: Bearer <AccessToken>

  1. Hent UserId, JTI, Expiry og DeviceId fra token-claims
  2. Revoker refresh token i PostgreSQL
  3. Blacklist access token i Redis (TTL = gjenværende levetid + ClockSkew)
  4. Logg utlogging i LoginHistory
```

### Logout alle enheter

```
POST /api/auth/logout-all
Headers: Authorization: Bearer <AccessToken>

  1. Hent UserId, JTI og Expiry fra token-claims
  2. Blacklist nåværende access token i Redis
  3. Revoker ALLE refresh tokens for brukeren i PostgreSQL
  4. Logg utlogging for alle enheter i LoginHistory
```

### API Request (autentisert)

```
Authorization: Bearer <AccessToken>

  1. JWT-validering (signatur, issuer, audience, levetid)
  2. TokenBlacklistMiddleware:
     └─ Hent JTI fra claims → Sjekk Redis → Avvis hvis blacklistet
  3. Authorization ([Authorize], roller, etc.)
  4. Request behandles
```

## Sikkerhetsmekanismer

### Token Rotation med Reuse Detection

Hver gang et refresh token brukes, roteres det: det gamle revokeres og et nytt genereres.
Hvis noen prøver å bruke et allerede revokert token, indikerer det mulig token-tyveri.
Da revokeres **alle** tokens for brukeren, og de tvinges til å logge inn på nytt fra alle enheter.

### Device Binding

Refresh token er bundet til en spesifikk enhet via `DeviceFingerprint`.
Ved refresh valideres fingerprint mot den lagrede verdien.
Selv om et token lekker, kan det ikke brukes fra en annen enhet.

### Redis Blacklisting

Når et access token revokeres (logout), blacklistes JTI-en i Redis med TTL lik
gjenværende levetid + `ClockSkewSeconds` buffer. Redis rydder opp automatisk
etter utløp. `TokenBlacklistMiddleware` sjekker blacklisten for hvert autentisert request.

Ved "logg ut alle enheter" blacklistes kun det nåværende access tokenet.
Andre aktive access tokens utløper naturlig innen 15 minutter.
Refresh tokens revokeres i PostgreSQL slik at de ikke kan fornyes.

### Timing-angrep-beskyttelse

Ved login med ukjent epost brukes en `DummyUser` med et passord hashet ved oppstart
med de aktive Argon2id-parametrene. Dette sikrer at responstiden er lik uavhengig
av om brukeren finnes eller ikke, og at hashen alltid matcher gjeldende parametere.

### Passord-hashing (Argon2id)

| Parameter | Verdi | Beskrivelse |
|-----------|-------|-------------|
| Salt | 16 bytes | Unik per bruker |
| Hash | 32 bytes | Output-størrelse |
| Iterations | 4 | Antall kjøringer |
| Memory | 128 MB | RAM-bruk per hashing |
| Parallelism | 4 | Samtidige tråder |

Bruker `CryptographicOperations.FixedTimeEquals` for sammenligning (konstant tid).
Overskriver Identity sin innebygde `IPasswordHasher<AppUser>` med `PasswordHashService`.

### Lockout

Identity sin innebygde lockout:
- 5 feilede forsøk → konto låst i 5 minutter
- Ved lockout-trigger rapporteres `SuspiciousActivity` (BruteForceAttempt)
- Lockout oppheves automatisk etter tid, eller manuelt ved passord-reset

## Endepunkter

| Metode | Rute | Beskrivelse | Auth |
|--------|------|-------------|------|
| POST | `/api/auth/login` | Logger inn, returnerer access + refresh token | Anonym |
| POST | `/api/token/refresh` | Fornyer tokens med refresh token rotation | Anonym |
| POST | `/api/auth/logout` | Logger ut fra én enhet | Autentisert |
| POST | `/api/auth/logout-all` | Logger ut fra alle enheter | Autentisert |

## Datamodeller

### RefreshToken

| Felt | Type | Beskrivelse |
|------|------|-------------|
| Id | int | Primærnøkkel |
| UserId | string | FK til AppUser |
| UserDeviceId | int | FK til UserDevice |
| Token | string (500) | Opak refresh token (Base64) |
| CreatedAt | DateTime | Opprettet |
| ExpiresAt | DateTime | Utløpstidspunkt |
| IsRevoked | bool | Om tokenet er revokert |
| RevokedAt | DateTime? | Tidspunkt for revokering |
| RevokedReason | string? (200) | Grunn: "User logout", "Rotated during refresh", etc. |
| IpAddress | string (45) | IP ved opprettelse |
| UserAgent | string? (500) | Browser/klient-info |

### UserDevice

| Felt | Type | Beskrivelse |
|------|------|-------------|
| Id | int | Primærnøkkel |
| UserId | string | FK til AppUser |
| DeviceName | string (200) | Enhetsnavn fra klient |
| DeviceFingerprint | string (500) | Unik enhet-identifikator fra klient |
| FirstSeenAt | DateTime | Første gang enheten ble brukt |
| LastUsedAt | DateTime | Siste gang enheten ble brukt |
| IsTrusted | bool | Om enheten er markert som klarert |
| LastIpAddress | string? (45) | Siste kjente IP |
| DeviceType | enum | Mobile, Desktop, Tablet, Unknown |
| OperatingSystem | enum | iOS, Android, Windows, macOS, etc. |
| Browser | string? (100) | Nettleser hvis web |

### LoginHistory

Logger hvert login/logout for audit trail. Knyttet til bruker og enhet.

## Avhengigheter

| Teknologi | Brukes til |
|-----------|-----------|
| ASP.NET Core Identity | Bruker-registrering, passord-validering, lockout |
| JWT (System.IdentityModel.Tokens.Jwt) | Access token generering og validering |
| Redis (StackExchange.Redis) | Access token blacklisting med TTL |
| PostgreSQL (EF Core) | Refresh tokens, devices, login history |
| Argon2id (Konscious.Security.Cryptography) | Passord-hashing |
| SignalR | WebSocket-autentisering via query parameter |
