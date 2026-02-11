# Account Verification

Håndterer verifisering av e-post og telefonnummer ved registrering,  
samt passord-reset med 6-sifret kode.

## Brukerflyt

```
Signup → Verify Email → Verify Phone → App klar
   │          │               │
   │          │               └─ ResendPhoneVerification (ved behov)
   │          └─ ResendVerification (ved behov)
   └─ Sender verifiseringsepost automatisk

Forgot Password (krever at både epost og telefon er verifisert)
   │
   ├─ Epost ikke verifisert → Sender verifiseringsepost, returnerer feil
   ├─ Telefon ikke verifisert → Sender verifiserings-SMS, returnerer feil
   └─ Begge verifisert → Sender reset-kode på epost
```

## Endepunkter

| Metode | Rute | Beskrivelse | Auth |
|--------|------|-------------|------|
| POST | `/api/auth/signup` | Registrerer bruker, sender verifiseringsepost | Anonym |
| POST | `/api/auth/resend-verification` | Sender ny verifiseringsepost | Anonym |
| POST | `/api/auth/verify-email` | Verifiserer epost med 6-sifret kode | Anonym |
| POST | `/api/auth/resend-phone-verification` | Sender ny verifiserings-SMS | Anonym |
| POST | `/api/auth/verify-phone` | Verifiserer telefon med 6-sifret kode | Anonym |
| POST | `/api/auth/forgot-password` | Sender reset-kode på epost | Anonym |
| POST | `/api/auth/reset-password` | Setter nytt passord med 6-sifret kode | Anonym |

Alle endepunkter krever IP-adresse og returnerer `400` hvis den ikke kan bestemmes.  
Enumeration-beskyttelse: `resend-verification`, `resend-phone-verification` og `forgot-password`  
returnerer alltid `200 OK` selv om bruker ikke finnes.

## Verifiseringskoder

Alle koder er 6-sifrede, generert med `RandomNumberGenerator.GetInt32(100000, 1000000)`.

| Type | Utløpstid | Forsøk | Lagring |
|------|-----------|--------|---------|
| E-post verifisering | 60 min | 5 | `VerificationInfo.EmailConfirmationCode` |
| Passord reset | 60 min | 5 | `VerificationInfo.PasswordResetCode` |
| Telefon verifisering | 10 min | 5 | `VerificationInfo.PhoneVerificationCode` |

Telefon har kortere utløpstid fordi SMS er mindre sikkert (SIM-swap, SS7-angrep).

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
| Rate limit nådd (epost) | `EmailRateLimitExceeded` | Signup, resend, forgot-password |
| Rate limit nådd (SMS) | `SmsRateLimitExceeded` | Resend phone verification |
| Duplikat e-post ved signup | `EmailEnumeration` | Signup |
| Duplikat telefon ved signup | `PhoneEnumeration` | Signup |
| 5 feilede kodeforsøk | `BruteForceAttempt` | verify-email, verify-phone, reset-password |

## Passord reset uten Identity-token

Passord-reset bruker kun 6-sifret kode (ingen Identity-token).  
Etter validert kode brukes `RemovePasswordAsync` + `AddPasswordAsync`.

E-post-lenke format: `{BaseUrl}/resetpassword?email={email}&code={code}`  
App-flyt: Bruker taster 6-sifret kode direkte.  
Begge kaller samme endepunkt: `POST /api/auth/reset-password`

## Konfigurasjon

Verdier i `VerificationConfig`:

| Innstilling | Verdi |
|-------------|-------|
| `MaxFailedAttempts` | 5 |
| `EmailCodeExpiryMinutes` | 60 |
| `PasswordResetCodeExpiryMinutes` | 60 |
| `PhoneCodeExpiryMinutes` | 10 |

## Filer

```
Features/Auth/
  Controllers/
    AuthController.cs
  DTOs/Request/
    ResendVerificationRequest.cs
    VerifyEmailRequest.cs
    ResendPhoneVerificationRequest.cs
    VerifyPhoneRequest.cs
    ForgotPasswordRequest.cs
    ResetPasswordRequest.cs
  Models/
    VerificationInfo.cs              ← Lagrer koder, utløpstid og forsøksteller
  Services/
    IAuthService.cs
    AuthService.cs                   ← Orkestrerer flyt, rate limit, suspicious activity
    IVerificationService.cs
    VerificationService.cs           ← Genererer/validerer koder, forsøksbegrensning
  Repositories/
    IVerificationRepository.cs
    VerificationRepository.cs

Infrastructure/Security/Services/
    IEmailRateLimitService.cs
    EmailRateLimitService.cs
    ISmsRateLimitService.cs
    SmsRateLimitService.cs
    ISuspiciousActivityService.cs

Infrastructure/Sms/Services/
    ISmsService.cs
    SmsService.cs                    ← Azure Communication Services

Configurations/Options/
    VerificationConfig.cs
    RateLimitConfig.cs
    SmsRateLimitConfig.cs
```
