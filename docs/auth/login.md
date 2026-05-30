# Login

## Oversikt

Innloggingsflyten er todelt: Steg 1 validerer passord og sender en MFA-kode på e-post. Steg 2 verifiserer koden og utsteder tokens. Flyten inkluderer timing-beskyttelse, lockout, og device tracking.

---

## Backend

### Endepunkter
| Metode | URL | Beskrivelse |
|--------|-----|-------------|
| `POST` | `/api/auth/login` | Steg 1 — passordvalidering + send MFA-kode |
| `POST` | `/api/auth/login/verify-mfa` | Steg 2 — verifiser kode + utsted tokens |

Begge er `[AllowAnonymous]`, rate limit: `Auth`-policy (8 req / 5 min per IP/fingerprint).

### Steg 1 — Request
```json
{
  "email": "user@example.com",
  "password": "MyPassword1",
  "device": {
    "deviceName": "Pixel 8",
    "deviceFingerprint": "abc123..."
  }
}
```

### Steg 1 — Flyt (`AuthService.LoginAsync`)

1. **Finn bruker** — `FindByEmailAsync`. Hvis ikke funnet, fortsett med `DummyUser` for å hindre timing-angrep.
2. **Lockout-sjekk** — `IsLockedOutAsync`. Returnerer `AccountLocked (2001)` med lockout-tidspunkt.
3. **Passordvalidering** — `CheckPasswordAsync` mot ekte bruker eller `DummyUser`. Samme svar uavhengig av om bruker finnes.
4. **AccessFailed** — ved feil passord økes Identity-telleren. Ved maks forsøk → lockout + `SuspiciousActivity`-rapport.
5. **E-postverifisering** — hvis `EmailConfirmed == false` → sender ny verifiserings-e-post og returnerer `EmailNotConfirmed (2002)`.
6. **SMS-verifisering** — hvis `PhoneNumberConfirmed == false` → sender ny verifiserings-SMS og returnerer `PhoneNotConfirmed (2003)`.
7. **Nullstill AccessFailed** — `ResetAccessFailedCountAsync` ved vellykket passord.
8. **Transaksjon:**
   - `GenerateLoginMfaCodeAsync` — generer og lagre 6-sifret kode i `VerificationInfo`
   - `emailService.SendAsync` — send MFA-kode på e-post. Feiler → `Failure` → rollback (kode ikke lagret)
9. **Returnerer** `200 OK` uten body — frontend navigerer til MFA-skjerm.

### Steg 2 — Request
```json
{
  "email": "user@example.com",
  "code": "123456",
  "device": {
    "deviceName": "Pixel 8",
    "deviceFingerprint": "abc123..."
  }
}
```

### Steg 2 — Flyt (`AuthService.VerifyMfaAsync`)

1. **Finn bruker** — ukjent e-post → `Unauthorized (1003)`.
2. **Valider MFA-kode** — `ValidateLoginMfaCodeAsync` (utenfor transaksjon — committer sin egen `SaveChanges`). Feil kode øker forsøksteller. Ved lockout → `SuspiciousActivity`-rapport.
3. **Transaksjon:**
   - `UserDeviceService.ResolveOrCreateDeviceAsync` — finn eller opprett device
   - `TokenService.GenerateTokenPairAsync` — generer JWT + refresh token
   - `LoginHistoryService.RecordLoginAsync` — logg innlogging
4. **Returnerer** `LoginResponse` med `accessToken`, `refreshToken`, `accessTokenExpires`, `refreshTokenExpires`, `user`.

### Hvorfor valideringen er utenfor transaksjonen i Steg 2

`ValidateLoginMfaCodeAsync` kaller `SaveChangesAsync` internt (for å lagre forsøksteller og nullstille koden).
Hvis vi wrapper validering + tokengenerering i én transaksjon, vil en feil i tokengenerering rulle tilbake
forsøkstelleren — og brukeren kan forsøke samme kode ubegrenset antall ganger.

Konsekvens: Hvis tokengenerering feiler etter vellykket MFA-validering, er koden allerede markert som brukt.
Brukeren må starte innloggingen på nytt for å få ny kode. Dette er akseptabelt — tokengenerering feiler ekstremt sjelden.

### MFA-kode-validering (`ValidateCodeAsync`)
- Maks 5 feilede forsøk (`VerificationConfig.MaxFailedAttempts`) → `TooManyRequests`
- Kode utløper etter 60 min (`VerificationConfig.EmailCodeExpiryMinutes`)
- Koden nullstilles etter vellykket validering

### Sikkerhetstiltak
- **DummyUser** — hindrer timing-angrep ved å alltid kjøre passord-hash, selv for ikke-eksisterende brukere
- **TimingGuard** — håndhever minimum 300ms responstid i steg 1 uavhengig av utfall
- **Identity lockout** — konfigurert via `IdentityOptions`
- **Token rotation** — refresh tokens er enkeltbruk; ved reuse revokeres alle tokens for brukeren
- **MFA** — kode på e-post kreves for alle innlogginger, uavhengig av enhet

### Feilkoder
| AppErrorCode | Verdi | Situasjon |
|---|---|---|
| `AccountLocked` | 2001 | For mange feilede passord-forsøk |
| `InvalidCredentials` | 2000 | Feil e-post eller passord |
| `EmailNotConfirmed` | 2002 | E-post ikke verifisert |
| `PhoneNotConfirmed` | 2003 | Telefon ikke verifisert |
| `InvalidCode` | 4000 | Feil MFA-kode |
| `ExpiredCode` | 4001 | MFA-kode utløpt |
| `TooManyRequests` | 1006 | For mange forsøk eller rate limit |

---

## Frontend

### Filer — Steg 1 (Login)
- `features/auth/screens/LoginScreen.tsx` — View
- `features/auth/hooks/useLogin.ts` — ViewModel (rhf + zod)
- `features/auth/services/authService.ts` — `loginUser()` + feilmapping

### Filer — Steg 2 (MFA)
- `features/auth/screens/LoginMfaScreen.tsx` — View
- `features/auth/hooks/useLoginMfa.ts` — ViewModel
- `features/auth/services/authService.ts` — `verifyMfaCode()` + feilmapping

### LoginScreen
- Logo + tagline i mørk navbar-seksjon
- Språkvelger (flagg-pill, venstre) og tema-toggle (sol/måne, høyre) i header
- E-post- og passord-felt via `react-hook-form` + `Controller`
- "Glemt passord?"-lenke → `ResetPasswordScreen`
- "Registrer deg her!"-lenke → `SignupScreen`
- Grønt `fromVerification`-banner hvis navigert hit etter fullført verifisering

### LoginMfaScreen
- Mørk navbar-header med `shield-checkmark`-ikon, tittel og e-postadressen
- Tilbake-knapp → `navigation.navigate("Login")`
- 6-sifret numerisk input med stor font og letter-spacing, `autoFocus`
- "Bekreft kode"-knapp — disabled til 6 siffer er tastet
- "Prøv igjen"-knapp med 60-sekunders cooldown — navigerer tilbake til Login (ny MFA-kode krever nytt passord-kall)

### Hook — `useLogin`
```typescript
const { control, errors, errorMessage, isSubmitting, handleLogin, clearError } = useLogin();
```
- `handleLogin` — kjøres av submit-knappen, validerer med zod før API-kall
- `errorMessage` — feilmelding for toast, vises og nullstilles via `clearError()`
- Feilhåndtering via `switch (result.code)` på `AuthErrorCode`

### Hook — `useLoginMfa`
```typescript
const { code, setCode, isLoading, resendCooldown, handleVerify, handleResend } = useLoginMfa(email);
```
- `handleVerify` — kaller `verifyMfaCode`, lagrer tokens via `login()` i `AuthContext` ved suksess
- `handleResend` — navigerer tilbake til Login (ikke et eget resend-endepunkt — passord-autentisering kreves for ny kode)
- Cooldown starter på 60 sekunder ved mount

### `authServiceNative` — todelt login
```typescript
// Steg 1 — returnerer void (ingen tokens ennå)
async login(email, password): Promise<void>

// Steg 2 — returnerer tokens og lagrer i Keychain
async verifyMfa(email, code): Promise<LoginResponseDTO>
```

### Navigasjon
| Utfall | Navigasjon |
|--------|-----------|
| Steg 1 suksess (200 OK) | `navigate` → `LoginMfaScreen { email }` |
| `EmailNotVerified` | `navigate` → `VerificationScreen { email }` |
| `PhoneNotVerified` | `navigate` → `PhoneSmsVerificationScreen { email }` |
| Feil credentials / locked | Toast med feilmelding, brukeren blir på Login |
| Steg 2 suksess | `login(accessToken, refreshToken)` → `isLoggedIn = true` → `MessagesScreen` |
| Steg 2 feil kode | Toast med feilmelding, kode-felt nullstilles |

### Feilmapping

`mapLoginError` — bruker `error.appCode`, aldri `error.status` eller string-matching:
```typescript
case AppErrorCode.EmailNotConfirmed:  → AuthErrorCode.EmailNotVerified
case AppErrorCode.PhoneNotConfirmed:  → AuthErrorCode.PhoneNotVerified
case AppErrorCode.InvalidCredentials: → AuthErrorCode.InvalidCredentials
case AppErrorCode.AccountLocked:      → AuthErrorCode.AccountLocked
```

`mapMfaError` — feil fra steg 2:
```typescript
case AppErrorCode.InvalidCode:    → AuthErrorCode.Unknown (viser backend-melding direkte)
case AppErrorCode.ExpiredCode:    → AuthErrorCode.Unknown (viser backend-melding direkte)
case AppErrorCode.TooManyRequests → AuthErrorCode.RateLimited
```
