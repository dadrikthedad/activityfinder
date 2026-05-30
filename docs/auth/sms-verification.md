# SMS-verifisering

## Oversikt

SMS-verifisering skjer etter e-postverifisering ved signup, og ved login med uverifisert telefon. Backend sender SMS automatisk ved mount av skjermen. Brukeren skriver inn 6-sifret kode.

---

## Backend

### Endepunkter
| Metode | URL | Beskrivelse |
|--------|-----|-------------|
| `POST` | `/api/verification/verify-phone` | Verifiser 6-sifret SMS-kode |
| `POST` | `/api/verification/resend-phone-verification` | Send ny verifiserings-SMS |

Begge bruker **e-post som identifikator** — backend slår opp telefonnummer internt fra e-post. `[AllowAnonymous]`, rate limit: `Auth`-policy.

### Verifiser kode (`AccountVerificationService.VerifyPhoneAsync`)

1. Finn bruker via e-post. Ukjent bruker → `Unauthorized`
2. Allerede verifisert → `Conflict (1002)`
3. **Transaksjon:**
   - `ValidatePhoneCodeAsync` — sjekker forsøksteller, utløp og kode-match
   - Ved `TooManyRequests` → `SuspiciousActivity`-rapport (brute force)
   - `user.PhoneNumberConfirmed = true` → `UpdateAsync`
   - `ClearSmsAttempts` — nullstill SMS rate limit cooldown

### Send på nytt (`AccountVerificationService.ResendPhoneVerificationAsync`)

1. Finn bruker. Ukjent bruker → returnerer `Success` (forhindrer phone enumeration)
2. Allerede verifisert → returnerer `Success`
3. Rate limit — `CheckSmsRateLimitAsync`
4. **Transaksjon:**
   - `GeneratePhoneVerificationAsync` — ny 6-sifret kode
   - `smsService.SendAsync` (46elks API). Feiler → `Failure` → rollback
   - `RegisterSmsSent` — registrer i SMS rate limit

### SMS rate limit (`SmsRateLimitConfig`)
- 2-minutters cooldown per kode-sending
- Maks 3 SMS per 24 timer per bruker (`MaxVerificationSmsPerDay`)
- Maks 5 SMS per IP per time (`MaxSmsPerIpPerHour`)

### Kode-validering
- Maks 5 feilede forsøk → `TooManyRequests`
- Kode utløper etter 10 min (`VerificationConfig.PhoneCodeExpiryMinutes`)
- Kortere enn e-post pga. lavere sikkerhet (SIM-swap, SS7-angrep)

### Feilkoder
| AppErrorCode | Verdi | Situasjon |
|---|---|---|
| `InvalidCode` | 4000 | Feil kode |
| `ExpiredCode` | 4001 | Koden utløpt (10 min) |
| `AlreadyVerified` | 4002 | Telefon allerede bekreftet |
| `TooManyRequests` | 1006 | Rate limit eller for mange forsøk |
| `InternalError` | 1005 | SMS-sending feilet |

---

## Frontend

### Filer
- `features/auth/screens/PhoneSmsVerificationScreen.tsx` — View
- `features/auth/services/verificationService.ts` — `verifySmsCode`, `resendSmsVerification`

### Skjerm
- Identisk layout som `VerificationScreen` — mørk navbar-header, ikon, tittel
- **SMS sendes automatisk ved mount** via `sendInitialSms` i `useEffect`
- Backend sin rate limit hindrer dobbel-sending hvis skjermen mountes igjen
- 6-sifret numerisk input
- "Bekreft kode"-knapp — disabled til 6 siffer
- "Send på nytt"-knapp med 2-minutters cooldown

### Automatisk SMS ved mount
```typescript
useEffect(() => {
  const sendInitialSms = async () => {
    if (!email) return;
    setIsLoading(true);
    await resendSmsVerification(email);  // backend rate limit hindrer dobbelsending
    setResendCooldown(120);
    setIsLoading(false);
  };
  sendInitialSms();
}, []);
```

### Route-params
```typescript
{ email: string }
```
E-post brukes som identifikator for alle SMS-kall — aldri telefonnummer direkte.

### Navigasjon
```
PhoneSmsVerificationScreen (success)
  → toast "Telefon bekreftet!"
  → 2 sek delay
  → navigation.replace → Login { fromVerification: true }

Login mottar fromVerification: true
  → viser grønt banner "Kontoen din er klar!"
```

### Kommer fra uverifisert login
Ved `AppErrorCode.PhoneNotConfirmed (2003)` fra login navigerer `useLogin` direkte til `PhoneSmsVerificationScreen`. Backend sender ny SMS automatisk via `ResendPhoneVerificationAsync` i samme login-kall.
