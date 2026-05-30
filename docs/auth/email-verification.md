# E-postverifisering

## Oversikt

E-postverifisering skjer etter signup og ved login med uverifisert e-post. Brukeren skriver inn en 6-sifret kode sendt på e-post, og navigerer videre til SMS-verifisering.

---

## Backend

### Endepunkter
| Metode | URL | Beskrivelse |
|--------|-----|-------------|
| `POST` | `/api/verification/verify-email` | Verifiser 6-sifret kode |
| `POST` | `/api/verification/resend-verification` | Send ny verifiserings-e-post |

Begge er `[AllowAnonymous]`, rate limit: `Auth`-policy.

### Verifiser kode (`AccountVerificationService.VerifyEmailAsync`)

1. Finn bruker via e-post. Ukjent bruker → `Unauthorized`
2. Allerede verifisert → `Conflict (1002)`
3. **Transaksjon:**
   - `ValidateEmailCodeAsync` — sjekker forsøksteller, utløp og kode-match
   - Ved `TooManyRequests` → `SuspiciousActivity`-rapport (brute force)
   - `user.EmailConfirmed = true` → `UpdateAsync`
   - `ClearEmailAttempts` — nullstill rate limit cooldown

### Send på nytt (`AccountVerificationService.ResendVerificationEmailAsync`)

1. Rate limit — `CheckEmailRateLimitAsync`
2. Finn bruker. Ukjent bruker → returnerer `Success` (forhindrer email enumeration)
3. Allerede verifisert → returnerer `Success` (ingen grunn til å sende)
4. **Transaksjon:**
   - `GenerateEmailVerificationAsync` — ny 6-sifret kode
   - `emailService.SendAsync` — send e-post. Feiler → `Failure` → rollback
   - `RegisterEmailSent` — registrer i rate limit

### Kode-validering (`ValidateCodeAsync`)
- Maks 5 feilede forsøk (`VerificationConfig.MaxFailedAttempts`) → `TooManyRequests`
- Kode utløper etter 60 min (`VerificationConfig.EmailCodeExpiryMinutes`)
- Koden nullstilles etter vellykket validering

### Feilkoder
| AppErrorCode | Verdi | Situasjon |
|---|---|---|
| `InvalidCode` | 4000 | Feil kode tastet inn |
| `ExpiredCode` | 4001 | Koden er utløpt |
| `AlreadyVerified` | 4002 | E-post allerede bekreftet |
| `TooManyRequests` | 1006 | 5 feilede forsøk eller rate limit |

---

## Frontend

### Filer
- `features/auth/screens/VerificationScreen.tsx` — View
- `features/auth/services/verificationService.ts` — `verifyEmailWithCode`, `resendVerificationEmail`

### Skjerm
- Mørk navbar-header med ikon, tittel og e-postadressen
- Tilbake-knapp (pill med ArrowLeft + "Tilbake") → `navigation.goBack()`
- 6-sifret numerisk input med stor font og letter-spacing
- "Bekreft kode"-knapp — disabled til 6 siffer er tastet
- "Send på nytt"-knapp med 2-minutters cooldown-timer (`formatTime`)
- Ved suksess: ikon bytter til checkmark, toast, 2 sek delay → navigate

### Navigasjon
```
VerificationScreen (success)
  → navigation.replace → PhoneSmsVerificationScreen { email }

VerificationScreen (kommer fra login med uverifisert e-post)
  → navigation.navigate fra LoginScreen
  → samme flyt
```

### Route-params
```typescript
{ email: string; fromRegistration?: boolean }
```
`fromRegistration` brukes ikke aktivt i skjermen nå, men kan brukes til å vise kontekstuell melding.

### Resend-cooldown
Cooldown startes ikke automatisk ved mount — bare når brukeren trykker "Send på nytt". Koden ble allerede sendt av backend ved signup eller ved uverifisert login.
