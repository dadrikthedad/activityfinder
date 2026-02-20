# Account Verification & Security

Håndterer verifisering av e-post og telefonnummer ved registrering,  
passord-reset med 2-stegs verifisering (epost + SMS),  
bytte av epost/telefon for innloggede brukere,  
og sikkerhetsvarsler med kontolåsing ved uautoriserte endringer.

## Brukerflyter

### Signup & verifisering

```
Signup → Verify Email → Verify Phone → App klar
   │          │               │
   │          │               └─ ResendPhoneVerification (ved behov)
   │          └─ ResendVerification (ved behov)
   └─ Sender verifiseringsepost automatisk
```

### Glemt passord (4 steg — krever verifisert epost og telefon)

```
ForgotPassword (steg 1)
   │
   ├─ Epost ikke verifisert → Sender verifiseringsepost, returnerer feil
   ├─ Telefon ikke verifisert → Sender verifiserings-SMS, returnerer feil
   └─ Begge verifisert → Sender reset-kode på epost
         │
         └─ VerifyPasswordResetEmailCode (steg 2) → Låser opp SMS-steg
               │
               └─ SendPasswordResetSms (steg 3) → Sender SMS-kode
                     │
                     └─ ResetPassword (steg 4) → Validerer SMS-kode, bytter passord
                           └─ Opphever evt. lockout ved suksess
```

### Bytte e-post (innlogget, 3 steg)

```
RequestEmailChange (steg 1)
   │ Krever passord. Sender til NÅVÆRENDE epost:
   │   - Verifiseringskode
   │   - Viser hvilken ny epost som er forespurt
   │   - "This wasn't me"-knapp (security alert)
   │
   └─ VerifyCurrentEmailForChange (steg 2)
         │ Verifiserer kode fra nåværende epost.
         │ Sender verifiseringskode til NY epost.
         │
         └─ VerifyEmailChange (steg 3)
               │ Verifiserer kode fra ny epost.
               └─ Oppdaterer epost, lagrer gammel epost i PreviousEmail
```

### Bytte telefonnummer (innlogget, 3 steg)

```
RequestPhoneChange (steg 1)
   │ Krever passord. Sender til NÅVÆRENDE epost:
   │   - Verifiseringskode
   │   - Viser hvilket nytt nummer som er forespurt
   │   - "This wasn't me"-knapp (security alert)
   │
   └─ VerifyCurrentEmailForPhoneChange (steg 2)
         │ Verifiserer epost-kode.
         │ Sender SMS-kode til NYTT nummer.
         │
         └─ VerifyPhoneChange (steg 3)
               │ Verifiserer SMS-kode fra nytt nummer.
               └─ Oppdaterer telefon, lagrer gammelt nummer i PreviousPhoneNumber
```

### Bytte passord (innlogget, 1 steg)

```
ChangePassword → Validerer nåværende passord → Setter nytt passord
```

### Sikkerhetsvarsling ("This wasn't me")

```
Bruker klikker "This wasn't me" i epost
   │
   └─ ReportUnauthorizedChange (uautentisert, via token)
         │
         ├─ Validerer engangs-token
         ├─ Nullstiller ALLE pending-endringer
         ├─ Ruller tilbake epost hvis PreviousEmail finnes
         ├─ Ruller tilbake telefon hvis PreviousPhoneNumber finnes
         ├─ Låser kontoen i 24 timer
         ├─ Rapporterer SuspiciousActivity
         └─ Sender AccountLocked-epost med reset-kode
               │
               └─ Bruker følger standard 4-stegs passord-reset flyt
                     └─ ResetPassword opphever lockout ved suksess
```

## Endepunkter

| Metode | Rute | Beskrivelse | Auth |
|--------|------|-------------|------|
| POST | `/api/auth/signup` | Registrerer bruker, sender verifiseringsepost | Anonym |
| POST | `/api/auth/login` | Logger inn bruker, returnerer JWT | Anonym |
| POST | `/api/auth/resend-verification` | Sender ny verifiseringsepost | Anonym |
| POST | `/api/auth/verify-email` | Verifiserer epost med 6-sifret kode | Anonym |
| POST | `/api/auth/resend-phone-verification` | Sender ny verifiserings-SMS | Anonym |
| POST | `/api/auth/verify-phone` | Verifiserer telefon med 6-sifret kode | Anonym |
| POST | `/api/auth/forgot-password` | Steg 1: Sender reset-kode på epost | Anonym |
| POST | `/api/auth/verify-password-reset-email` | Steg 2: Verifiserer epost-kode, låser opp SMS | Anonym |
| POST | `/api/auth/send-password-reset-sms` | Steg 3: Sender SMS-kode | Anonym |
| POST | `/api/auth/reset-password` | Steg 4: Validerer SMS + bytter passord | Anonym |
| POST | `/api/auth/change-password` | Bytter passord for innlogget bruker | Autentisert |
| POST | `/api/auth/request-email-change` | Steg 1: Starter epost-bytte, sender kode + alert til NÅVÆRENDE epost | Autentisert |
| POST | `/api/auth/verify-current-email-change` | Steg 2: Verifiserer kode fra nåværende epost, sender kode til NY epost | Autentisert |
| POST | `/api/auth/verify-email-change` | Steg 3: Verifiserer kode fra ny epost, oppdaterer epost | Autentisert |
| POST | `/api/auth/request-phone-change` | Steg 1: Starter telefon-bytte, sender kode + alert til NÅVÆRENDE epost | Autentisert |
| POST | `/api/auth/verify-current-email-phone-change` | Steg 2: Verifiserer epost-kode, sender SMS til NYTT nummer | Autentisert |
| POST | `/api/auth/verify-phone-change` | Steg 3: Verifiserer SMS-kode, oppdaterer telefonnummer | Autentisert |
| POST | `/api/auth/report-unauthorized-change` | "This wasn't me" — låser konto via token i query string | Anonym |

Alle endepunkter krever IP-adresse og returnerer `400` hvis den ikke kan bestemmes.  
Enumeration-beskyttelse: `resend-verification`, `resend-phone-verification` og `forgot-password`  
returnerer alltid `200 OK` selv om bruker ikke finnes.

## Verifiseringskoder & tokens

Alle koder er 6-sifrede, generert med `RandomNumberGenerator.GetInt32(100000, 1000000)`.  
Security alert token er `Guid.NewGuid().ToString("N")` (32 hex-tegn).

| Type | Utløpstid | Forsøk | Lagring |
|------|-----------|--------|---------|
| E-post verifisering | 60 min | 5 | `VerificationInfo.EmailConfirmationCode` |
| Telefon verifisering | 10 min | 5 | `VerificationInfo.PhoneVerificationCode` |
| Passord reset (epost) | 60 min | 5 | `VerificationInfo.EmailPasswordResetCode` |
| Passord reset (SMS) | 10 min | 5 | `VerificationInfo.SmsPasswordResetCode` |
| Epost-bytte — gammel epost (steg 1) | 60 min | 5 | `VerificationInfo.OldEmailChangeCode` |
| Epost-bytte — ny epost (steg 2) | 60 min | 5 | `VerificationInfo.NewEmailChangeCode` |
| Telefon-bytte — epost (steg 1) | 60 min | 5 | `VerificationInfo.PhoneChangeEmailCode` |
| Telefon-bytte — SMS (steg 2) | 10 min | 5 | `VerificationInfo.NewPhoneChangeCode` |
| Security alert token | 24 timer | Engangs | `VerificationInfo.SecurityAlertToken` |

Begge bytte-flyter bruker separate kodefelt per steg slik at forsøkstellere og utløpstider er uavhengige.  
Telefon/SMS har kortere utløpstid fordi SMS er mindre sikkert (SIM-swap, SS7-angrep).  
Security alert token har lengre utløpstid fordi brukeren kanskje ikke sjekker epost med en gang.

## Forsøksbegrensning

Hver kodetype har en forsøksteller som økes ved feil kode.  
Etter 5 feilede forsøk returneres `TooManyRequests` og koden er låst.

```
Forsøk 1-4: "Invalid verification code" (teller økes)
Forsøk 5:   Koden låses
Forsøk 6+:  "Too many failed attempts. Please request a new verification code."
            → SuspiciousActivity rapporteres (BruteForceAttempt)
```

Telleren nullstilles når:
- Ny kode genereres (via resend)
- Koden valideres korrekt

## Sikkerhetslag

Hver request passerer gjennom flere lag:

```
1. ASP.NET Rate Limiting (Auth policy: 8 req/5 min per IP)
2. IP Ban Middleware (sjekker om IP er bannet)
3. Email/SMS Rate Limit Service (cooldown + daglig grense + IP-grense)
4. Forsøksbegrensning i VerificationService (5 forsøk per kode)
5. SuspiciousActivity-rapportering → kan trigge IP-ban
```

## Rate limiting

### E-post (via EmailRateLimitService)
| Grense | Verdi |
|--------|-------|
| Cooldown mellom e-poster | 2 min |
| Verifiseringseposter per dag | 5 |
| Reset-eposter per dag | 3 |
| E-poster per IP per time | 10 |

### SMS (via SmsRateLimitService)
| Grense | Verdi |
|--------|-------|
| Cooldown mellom SMS | 2 min |
| Verifiserings-SMS per dag | 3 |
| SMS per IP per time | 5 |

SMS er strengere fordi det koster penger og er mer utsatt for misbruk.

## SuspiciousActivity-triggers

| Hendelse | Type | Trigger |
|----------|------|---------|
| Rate limit nådd (epost) | `EmailRateLimitExceeded` | Signup, resend, forgot-password, email-change, phone-change |
| Rate limit nådd (SMS) | `SmsRateLimitExceeded` | Resend phone, password reset SMS, phone-change |
| Duplikat e-post ved signup | `EmailEnumeration` | Signup |
| Duplikat telefon ved signup | `PhoneEnumeration` | Signup |
| 5 feilede kodeforsøk | `BruteForceAttempt` | Alle verify-endepunkter |
| Uautorisert endring rapportert | `UnauthorizedChangeReported` | report-unauthorized-change |

## Passord reset uten Identity-token

Passord-reset bruker kun 6-sifret kode (ingen Identity-token).  
Etter validert SMS-kode brukes `RemovePasswordAsync` + `AddPasswordAsync`.

E-post-lenke format: `{BaseUrl}/resetpassword?email={email}&code={code}`  
App-flyt: Bruker taster 6-sifret kode direkte.

## E-postmaler

| Template | Sendes til | Innhold | Brukes av |
|----------|-----------|---------|-----------|
| `Verification` | Ny brukers epost | Verifiseringslenke + kode + "ignore"-tekst | Signup, ResendVerification |
| `Welcome` | Brukerens epost | Velkomstmelding etter verifisering | VerifyEmail |
| `PasswordReset` | Brukerens epost | Reset-lenke + kode + SMS-påminnelse | ForgotPassword |
| `AccountLocked` | Brukerens epost (evt. PreviousEmail) | Sikkerhetsstatus + reset-lenke + kode + SMS-påminnelse | ReportUnauthorizedChange |
| `EmailChangeVerification` | Brukerens NÅVÆRENDE epost | Kode + ny epost-visning + "This wasn't me"-knapp | RequestEmailChange |
| `EmailChange` | NY epostadresse | Verifiseringslenke + kode | VerifyCurrentEmailForChange |
| `PhoneChangeVerification` | Brukerens NÅVÆRENDE epost | Kode + nytt nummer-visning + "This wasn't me"-knapp | RequestPhoneChange |
| `SecurityAlert` | Brukerens NÅVÆRENDE epost | Varsel + "This wasn't me"-knapp | Reservert for fremtidig bruk |

### Designvalg for e-postmaler
- **EmailChangeVerification** er en kombinert mal som sendes til nåværende epost med både verifiseringskode og "This wasn't me"-knapp (steg 1 av epost-bytte)
- **EmailChange** er forenklet til kun verifisering av ny epost uten "This wasn't me" (steg 2 — brukeren har allerede bekreftet via gammel epost)
- **PhoneChangeVerification** er en kombinert mal som sendes til nåværende epost med verifiseringskode og "This wasn't me"-knapp (steg 1 av telefon-bytte)
- **SecurityAlert** er en generisk varslings-mal reservert for fremtidig bruk (f.eks. konto-lockdown fra andre triggere)
- **AccountLocked** er en egen mal med alvorlig tone som forklarer hva som har skjedd (konto låst, endringer kansellert) og at passord MÅ tilbakestilles for å gjenåpne kontoen
- **PasswordReset** inneholder påminnelse om at SMS-verifisering er nødvendig
- **Verification** inneholder beroligende tekst: "If you didn't sign up, ignore this email"
- **PreviousEmail** og **PreviousPhoneNumber** lagres i VerificationInfo slik at endringer kan rulles tilbake ved "This wasn't me" etter fullført bytte
- Ingen maler avslører tidsbegrensninger som kan gi angripere taktisk informasjon

## Sikkerhetsvarsling — detaljert flyt

### Ved epost-bytte (3 steg)
1. `RequestEmailChangeAsync` genererer `OldEmailChangeCode` + security alert token
2. Én epost sendes til NÅVÆRENDE adresse med begge (kode + "This wasn't me"-lenke) via `EmailChangeVerification`-malen
3. `VerifyCurrentEmailForChangeAsync` validerer koden og genererer `NewEmailChangeCode`
4. Ny epost sendes til NY adresse med kun verifiseringskode via `EmailChange`-malen
5. `VerifyEmailChangeAsync` validerer koden, oppdaterer epost og lagrer gammel epost i `PreviousEmail`

### Ved telefon-bytte (3 steg)
1. `RequestPhoneChangeAsync` genererer `PhoneChangeEmailCode` + security alert token
2. Én epost sendes til NÅVÆRENDE adresse med begge (kode + "This wasn't me"-lenke) via `PhoneChangeVerification`-malen
3. `VerifyCurrentEmailForPhoneChangeAsync` validerer epost-koden og genererer `NewPhoneChangeCode`
4. SMS sendes til NYTT nummer med verifiseringskode
5. `VerifyPhoneChangeAsync` validerer SMS-koden, oppdaterer telefon og lagrer gammelt nummer i `PreviousPhoneNumber`

### "This wasn't me"-håndtering
1. Token valideres og konsumeres (engangsbruk)
2. Alle pending-endringer nullstilles atomisk (epost steg 1 + 2, telefon steg 1 + 2, passord-reset)
3. Hvis `PreviousEmail` finnes: epost rulles tilbake til gammel adresse
4. Hvis `PreviousPhoneNumber` finnes: telefon rulles tilbake til gammelt nummer
5. Konto låses via Identity i 24 timer
6. `AccountLocked`-epost sendes med reset-kode til riktig epostadresse
7. Bruker følger standard 4-stegs reset-flyt → lockout oppheves ved suksess

### Sikkerhetsvurdering — epost-bytte

| Angrepsscenario | Gammel flyt (2 steg) | Ny flyt (3 steg) |
|-----------------|----------------------|-------------------|
| Angriper har passord, prøver å bytte epost | Kode sendes til ny epost (angriperen) | Kode sendes til gammel epost (den ekte brukeren) — angrepet stopper |
| Angriper fullfører bytte, bruker klikker "This wasn't me" | Reset-epost sendes til ny epost (angriperen) | Epost rulles tilbake + reset sendes til gammel epost (den ekte brukeren) |
| Angriper har passord men ikke tilgang til epost | Kan fullføre byttet | Kan ikke komme forbi steg 1 |

### Sikkerhetsvurdering — telefon-bytte

| Angrepsscenario | Gammel flyt (2 steg) | Ny flyt (3 steg) |
|-----------------|----------------------|-------------------|
| Angriper har passord, prøver å bytte nummer | SMS sendes til nytt nummer (angriperen) | Kode sendes til epost (den ekte brukeren) — angrepet stopper |
| Angriper fullfører bytte, bruker klikker "This wasn't me" | Telefon allerede byttet, ingen rollback | Telefon rulles tilbake + reset sendes til ekte epost |
| Angriper har passord men ikke tilgang til epost | Kan fullføre byttet | Kan ikke komme forbi steg 1 |

## Kontolåsing

| Scenario | Lockout-varighet | Oppheves av |
|----------|-----------------|-------------|
| For mange feilede login-forsøk | Identity default | Tid / admin |
| "This wasn't me"-rapportering | 24 timer | Fullført passord-reset |

`ResetPasswordAsync` sjekker lockout-status og opphever den ved suksess,  
slik at samme passord-reset-flyt fungerer for både vanlig "glemt passord" og post-lockout recovery.

## Konfigurasjon

Verdier i `VerificationConfig`:

| Innstilling | Verdi |
|-------------|-------|
| `MaxFailedAttempts` | 5 |
| `EmailCodeExpiryMinutes` | 60 |
| `PhoneCodeExpiryMinutes` | 10 |
| `SecurityAlertTokenExpiryHours` | 24 |
