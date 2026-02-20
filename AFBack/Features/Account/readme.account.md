# Account Feature

Håndterer kontoendringer for innloggede brukere: bytte av navn, profilbilde,
epost og telefonnummer. Alle endepunkter krever autentisering via JWT.

## Endepunkter

### AccountController — `/api/account`

| Metode | Rute | Beskrivelse | Krever passord |
|--------|------|-------------|----------------|
| PUT | `/api/account/name` | Bytter fornavn og etternavn | Nei |
| POST | `/api/account/request-email-change` | Steg 1: Starter epost-bytte | Ja |
| POST | `/api/account/verify-current-email-change` | Steg 2: Verifiser kode fra nåværende epost | Nei |
| POST | `/api/account/verify-email-change` | Steg 3: Verifiser kode fra ny epost | Nei |
| POST | `/api/account/request-phone-change` | Steg 1: Starter telefon-bytte | Ja |
| POST | `/api/account/verify-current-email-phone-change` | Steg 2: Verifiser epost-kode | Nei |
| POST | `/api/account/verify-phone-change` | Steg 3: Verifiser SMS-kode fra nytt nummer | Nei |

Alle endepunkter er `[Authorize]`. Rate limiting bruker Account-policy (mer generøs enn Auth).

## Brukerflyter

### Bytte navn

```
PUT /api/account/name
Body: { FirstName, LastName }

  1. Hent bruker fra JWT (userId)
  2. Oppdater FirstName, LastName, FullName
  3. Returner 200 OK
```

Ingen passord-verifisering — brukeren er allerede autentisert.
Navn trimmes automatisk i DTO-en.

### Bytte profilbilde

Kommer. Oppdaterer AppUser.ProfileImageUrl.

### Bytte e-post (3 steg)

```
Steg 1: POST /api/account/request-email-change
Body: { CurrentPassword, NewEmail }

  1. Valider passord
  2. Sjekk at ny epost ikke er i bruk
  3. Sjekk at ny epost ≠ nåværende epost
  4. Generer verifiseringskode for NÅVÆRENDE epost
  5. Generer security alert token
  6. Send epost til NÅVÆRENDE adresse med kode + "This wasn't me"-lenke

Steg 2: POST /api/account/verify-current-email-change
Body: { Code }

  1. Valider kode fra nåværende epost
  2. Generer verifiseringskode for NY epost
  3. Send kode til NY epostadresse

Steg 3: POST /api/account/verify-email-change
Body: { Code }

  1. Valider kode fra ny epost
  2. Dobbeltsjekk at eposten fortsatt er ledig
  3. Lagre gammel epost i PreviousEmail (for rollback)
  4. Oppdater Email, NormalizedEmail, UserName, NormalizedUserName
```

### Bytte telefonnummer (3 steg)

```
Steg 1: POST /api/account/request-phone-change
Body: { CurrentPassword, NewPhoneNumber }

  1. Valider passord
  2. Sjekk at nytt nummer ikke er i bruk
  3. Sjekk at nytt nummer ≠ nåværende nummer
  4. Generer verifiseringskode for epost
  5. Generer security alert token
  6. Send epost med kode + "This wasn't me"-lenke

Steg 2: POST /api/account/verify-current-email-phone-change
Body: { Code }

  1. Valider epost-kode
  2. Generer SMS-kode for NYTT nummer
  3. Send SMS til nytt nummer

Steg 3: POST /api/account/verify-phone-change
Body: { Code }

  1. Valider SMS-kode fra nytt nummer
  2. Dobbeltsjekk at nummeret fortsatt er ledig
  3. Lagre gammelt nummer i PreviousPhoneNumber (for rollback)
  4. Oppdater PhoneNumber, sett PhoneNumberConfirmed = true
```

### Sikkerhetsvurdering — hvorfor 3 steg?

Epost og telefon er sikkerhetskritiske felt — de brukes til innlogging og passord-reset.
Steg 1 sender kode til NÅVÆRENDE kontaktinfo, ikke til den nye. Dette forhindrer at en
angriper med passord kan bytte epost/telefon uten tilgang til brukerens eksisterende kanaler.

| Angrepsscenario | 2-stegs flyt | 3-stegs flyt |
|-----------------|--------------|---------------|
| Angriper har passord, prøver å bytte epost | Kode sendes til ny epost (angriperen) | Kode sendes til gammel epost — angrepet stopper |
| Angriper fullfører bytte, bruker klikker "This wasn't me" | Reset sendes til ny epost (angriperen) | Epost rulles tilbake, reset sendes til gammel epost |

"This wasn't me"-håndtering ligger i Auth-featurens AuthController
(`POST /api/auth/report-unauthorized-change`). Se `readme.auth.md` for detaljer.

## DTOs

### Request

| DTO | Felt | Validering |
|-----|------|------------|
| `ChangeNameRequest` | FirstName, LastName | Required, MaxLength(100), Trim |
| `ChangeEmailRequest` | CurrentPassword, NewEmail | Required, EmailAddress, MaxLength(256) |
| `ChangePhoneRequest` | CurrentPassword, NewPhoneNumber | Required, Phone, MaxLength(20) |
| `VerifyCodeRequest` | Code | Required, 6 siffer (regex) |

## Service-arkitektur

```
AccountController
└── IAccountChangeService
    ├── UserManager<AppUser>                   ← Finn bruker, valider passord, oppdater
    ├── IVerificationInfoService (fra Auth)    ← Kode-generering og validering
    ├── IVerificationInfoRepository (fra Auth) ← Hent VerificationInfo for rollback-felter
    ├── IUserRepository (fra Auth)             ← FindByPhoneAsync for duplikat-sjekk
    ├── IEmailService                          ← Send epost
    ├── ISmsService                            ← Send SMS
    ├── IEmailRateLimitService                 ← Rate limiting for epost
    ├── ISmsRateLimitService                   ← Rate limiting for SMS
    └── ISuspiciousActivityService             ← Rapporter mistenkelig aktivitet
```

### Kryss-avhengigheter

Account → Auth (via interfaces):
- `IVerificationInfoService` — all kode-generering og validering
- `IVerificationInfoRepository` — PreviousEmail/PreviousPhoneNumber for rollback
- `IUserRepository` — telefon duplikat-sjekk

Auth → Account: Ingen direkte avhengighet.

## Filstruktur

```
Features/Account/
├── Controllers/
│   └── AccountController.cs           ← Alle kontoendring-endepunkter
├── DTOs/
│   ├── Requests/
│   │   ├── ChangeNameRequest.cs       ← FirstName + LastName med Trim
│   │   ├── ChangeEmailRequest.cs      ← Password + NewEmail
│   │   ├── ChangePhoneRequest.cs      ← Password + NewPhoneNumber
│   │   └── VerifyCodeRequest.cs       ← 6-sifret kode
│   └── Responses/
│       └── (ingen foreløpig)
├── Services/
│   ├── IAccountChangeService.cs
│   └── AccountChangeService.cs
└── readme.account.md                  ← Denne filen
```

## Modeller

Account-featuren bruker modeller fra Auth:
- `AppUser` — FirstName, LastName, FullName, ProfileImageUrl, Email, PhoneNumber
- `VerificationInfo` — PreviousEmail, PreviousPhoneNumber, alle kode-felter

Ingen egne modeller eller database-tabeller.

## Rate Limiting

Account-endepunkter bruker `Account`-policy som er mer generøs enn Auth-policyen.
Brukeren er allerede autentisert via JWT. Epost/telefon-bytte har i tillegg
Email/SMS Rate Limit Service som ekstra beskyttelse.

| Lag | Beskrivelse |
|-----|-------------|
| Account rate limit policy | Generell begrensning per bruker |
| Email/SMS Rate Limit Service | Cooldown + daglig grense for kode-utsending |
| VerificationInfoService forsøksteller | 5 forsøk per kode |
