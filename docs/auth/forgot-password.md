# Glemt passord (Forgot Password)

## Oversikt

4-stegs flyt: e-postkode → verifiser e-post → SMS-kode → verifiser SMS → sett nytt passord. All state lever i `useResetPassword`-hooken. Ingen egne navigasjonsruter per steg — alt skjer inne i `ResetPasswordScreen` via `ResetStep`-state.

---

## Backend

### Endepunkter
| Metode | URL | Auth | Beskrivelse |
|--------|-----|------|-------------|
| `POST` | `/api/password-reset/forgot-password` | Anonym | Steg 1: Send e-postkode |
| `POST` | `/api/password-reset/verify-password-reset-email` | Anonym | Steg 2: Verifiser e-postkode |
| `POST` | `/api/password-reset/send-password-reset-sms` | Anonym | Steg 3: Send SMS-kode |
| `POST` | `/api/password-reset/verify-password-reset-sms` | Anonym | Steg 3b: Verifiser SMS-kode |
| `POST` | `/api/password-reset/reset-password` | Anonym | Steg 4: Sett nytt passord |
| `POST` | `/api/password-reset/change-password` | Autentisert | Bytt passord (innlogget) |

Alle rate limitert med `Auth`-policy.

---

### Steg 1 — Send e-postkode (`ForgotPasswordAsync`)

**Request:** `{ "email": "user@example.com" }`

1. Rate limit — `CheckEmailRateLimitAsync (EmailType.PasswordReset)`
2. Finn bruker. Ukjent bruker → returnerer `Success` (forhindrer email enumeration)
3. E-post ikke verifisert → send ny verifiserings-e-post + returner `EmailNotConfirmed (2002)`
4. Telefon ikke verifisert → send ny verifiserings-SMS + returner `PhoneNotConfirmed (2003)`
5. **Transaksjon:**
   - `GenerateEmailPasswordResetAsync` — 6-sifret kode, setter `EmailPasswordResetVerified = false`, nullstiller alle SMS-reset-felter
   - `emailService.SendAsync` — send reset-e-post. Feiler → `Failure` → rollback
   - `RegisterEmailSent` — registrer rate limit

---

### Steg 2 — Verifiser e-postkode (`VerifyPasswordResetEmailCodeAsync`)

**Request:** `{ "email": "...", "code": "123456" }`

1. Finn bruker. Ukjent → `Unauthorized`
2. `ValidateEmailPasswordResetCodeAsync`:
   - Sjekker forsøksteller (maks 5), utløp (60 min) og kode-match
   - Ved suksess: `EmailPasswordResetVerified = true`, kode nullstilles
   - Ved `TooManyRequests` → `SuspiciousActivity`-rapport

---

### Steg 3 — Send SMS-kode (`SendPasswordResetSmsAsync`)

**Request:** `{ "email": "..." }`

1. Finn bruker. Ukjent → `Unauthorized`
2. Rate limit — `CheckSmsRateLimitAsync (SmsType.PasswordReset)`
3. **Transaksjon:**
   - `GenerateSmsPasswordResetCodeAsync` — krever `EmailPasswordResetVerified == true` (guard)
   - `smsService.SendAsync` — send SMS. Feiler → `Failure` → rollback (ingen løs kode i DB)
   - `RegisterSmsSent` — registrer rate limit

---

### Steg 3b — Verifiser SMS-kode (`VerifyPasswordResetSmsAsync`)

**Request:** `{ "email": "...", "code": "123456" }`

1. Finn bruker. Ukjent → `Unauthorized`
2. `ValidateSmsPasswordResetCodeAsync`:
   - Krever `EmailPasswordResetVerified == true` (guard)
   - Sjekker forsøksteller (maks 5), utløp (10 min) og kode-match
   - Ved suksess: `SmsPasswordResetVerified = true`, `SmsPasswordResetVerifiedAt = DateTime.UtcNow`, kode nullstilles
   - Ved `TooManyRequests` → `SuspiciousActivity`-rapport

---

### Steg 4 — Sett nytt passord (`ResetPasswordAsync`)

**Request:** `{ "email": "...", "newPassword": "NewPassword1" }`

SMS-koden sendes **ikke** i steg 4 — den ble allerede validert i steg 3b.

1. Finn bruker. Ukjent → `Unauthorized`
2. **Transaksjon:**
   - `IsSmsPasswordResetVerifiedAsync` — sjekker:
     - `SmsPasswordResetVerified == true` → ellers `ResetSessionNotVerified (5001)`
     - `SmsPasswordResetVerifiedAt + 10 min > UtcNow` → ellers `ResetSessionExpired (5002)`
   - `RemovePasswordAsync` — fjern gammelt passord
   - `AddPasswordAsync` — sett nytt passord (Identity-validering)
   - `ClearEmailAttempts` + `ClearSmsAttempts` — nullstill rate limit cooldown
   - Opphev lockout hvis aktiv

### Tidsvindu
`VerificationConfig.PasswordResetWindowMinutes = 10` — brukeren har 10 minutter etter SMS-verifisering til å sette nytt passord. Etter det returneres `ResetSessionExpired`.

### Feilkoder
| AppErrorCode | Verdi | Situasjon |
|---|---|---|
| `EmailNotConfirmed` | 2002 | Bruker prøver reset uten verifisert e-post |
| `PhoneNotConfirmed` | 2003 | Bruker prøver reset uten verifisert telefon |
| `InvalidCode` | 4000 | Feil kode |
| `ExpiredCode` | 4001 | Koden utløpt |
| `TooManyRequests` | 1006 | For mange forsøk eller rate limit |
| `ResetSessionNotVerified` | 5001 | SMS ikke verifisert, hopp til steg 4 ikke tillatt |
| `ResetSessionExpired` | 5002 | 10-minuttersvinduet er utløpt |
| `InternalError` | 1005 | SMS- eller e-postsending feilet |

---

## Frontend

### Filer
- `features/auth/screens/ResetPasswordScreen.tsx` — View (alle 4 steg i én skjerm)
- `features/auth/hooks/useResetPassword.ts` — ViewModel
- `features/auth/services/verificationService.ts` — alle API-funksjoner for reset
- `core/api/routes.ts` — `ApiRoutes.passwordReset.*`

### Steg-state (`ResetStep`)
```typescript
type ResetStep = "request" | "code" | "sms" | "password";
```
Steg-overganger styres av `setStep()` i hooken — skjermen rendrer riktig innhold basert på `step`.

### Skjerm-layout
- `AppHeader` med "Tilbakestill passord", tilbake-pil → `navigation.goBack()`
- Dynamisk ikon (`key` / `mail` / `phone-portrait` / `lock-closed`) og tittel per steg
- Steg 1: E-postfelt + send-knapp
- Steg 2: 6-sifret kode-input + verifiser-knapp + resend med cooldown (e-post)
- Steg 3: 6-sifret kode-input + verifiser-knapp + resend med cooldown (SMS)
- Steg 4: `PasswordFieldNative` x2 via `react-hook-form` + `Controller` (zod-validering)

### Hook (`useResetPassword`)
```typescript
const {
  step, email, setEmail,
  code, setCode,           // e-postkode (steg 2)
  smsCode, setSmsCode,     // SMS-kode (steg 3)
  isLoading,
  resendEmailCooldown,     // nedtelling for e-post resend
  resendSmsCooldown,       // nedtelling for SMS resend
  control, errors, isSubmitting,
  handleRequestReset,      // steg 1
  handleVerifyEmailCode,   // steg 2 → verifiserer e-post + sender SMS automatisk
  handleVerifySmsCode,     // steg 3 → verifiserer SMS mot backend
  handleResendSms,         // steg 3 → send SMS på nytt
  handleResetPassword,     // steg 4 → rhf handleSubmit
} = useResetPassword();
```

### Steg 2 → 3: SMS sendes automatisk
Ved vellykket e-postverifisering kaller `handleVerifyEmailCode` automatisk `sendPasswordResetSms` før den navigerer til steg 3. Brukeren trenger ikke trykke en ekstra knapp.

```typescript
const verifyResult = await verifyPasswordResetEmailCode(email, code);
if (!verifyResult.success) { /* feilhåndtering */ return; }

const smsResult = await sendPasswordResetSms(email);
if (smsResult.success) {
  setResendSmsCooldown(120);
  setStep("sms");
}
```

### Steg 4: Ingen kode sendes
`resetPassword(email, newPassword)` — SMS-koden er allerede validert i steg 3b. Backend sjekker `SmsPasswordResetVerified`-flagget og `SmsPasswordResetVerifiedAt`-tidsvinduet.

### SessionExpired-håndtering
Hvis steg 4 returnerer `SessionExpired` eller `SessionNotVerified`:
- Toast med forklarende melding
- `setStep("request")` — tilbake til steg 1
- Nullstill `email`, `code`, `smsCode`

### Navigasjon
```
ResetPasswordScreen (steg 4 suksess)
  → toast "Passord tilbakestilt!"
  → 2 sek delay
  → navigation.replace → Login
```

### API-routes
```typescript
ApiRoutes.passwordReset.forgot         // POST /api/password-reset/forgot-password
ApiRoutes.passwordReset.verifyEmail    // POST /api/password-reset/verify-password-reset-email
ApiRoutes.passwordReset.sendSms        // POST /api/password-reset/send-password-reset-sms
ApiRoutes.passwordReset.verifySms      // POST /api/password-reset/verify-password-reset-sms
ApiRoutes.passwordReset.reset          // POST /api/password-reset/reset-password
ApiRoutes.passwordReset.changePassword // POST /api/password-reset/change-password
```

### Feilmapping (`mapPasswordResetError`)
```typescript
case AppErrorCode.ResetSessionNotVerified: → PasswordResetErrorCode.SessionNotVerified
case AppErrorCode.ResetSessionExpired:     → PasswordResetErrorCode.SessionExpired
case AppErrorCode.InvalidCode:             → PasswordResetErrorCode.InvalidCode
case AppErrorCode.ExpiredCode:             → PasswordResetErrorCode.ExpiredCode
case AppErrorCode.EmailNotFound:           → PasswordResetErrorCode.EmailNotFound
```
