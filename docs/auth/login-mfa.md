# Login MFA

## Oversikt

Login MFA er steg 2 av innloggingsflyten. Etter vellykket passord-validering i steg 1 sendes en 6-sifret kode til brukerens e-post. Brukeren taster inn koden for å fullføre innloggingen og motta tokens.

Se [login.md](login.md) for hele innloggingsflyten inkludert steg 1.

---

## Backend

### Endepunkt
`POST /api/auth/login/verify-mfa` — `[AllowAnonymous]`, rate limit: `Auth`-policy

### Request
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

### Respons
```json
{
  "accessToken": "eyJ...",
  "refreshToken": "abc123...",
  "accessTokenExpires": "2025-01-01T12:15:00Z",
  "refreshTokenExpires": "2026-01-01T12:00:00Z",
  "user": { ... }
}
```

### Flyt (`AuthService.VerifyMfaAsync`)

1. **Finn bruker** — ukjent e-post → `Unauthorized (1003)`
2. **Valider MFA-kode** — `ValidateLoginMfaCodeAsync` — sjekker forsøksteller, utløp og kode-match. Kaller `SaveChangesAsync` internt (utenfor transaksjon).
3. **Brute force-rapport** — ved `TooManyRequests` → `SuspiciousActivity`-rapport
4. **Transaksjon:**
   - `UserDeviceService.ResolveOrCreateDeviceAsync`
   - `TokenService.GenerateTokenPairAsync`
   - `LoginHistoryService.RecordLoginAsync`
5. **Returnerer** `LoginResponse`

### MFA-kode-lagring (`VerificationInfo`)

MFA-koden lagres i `VerificationInfo`-tabellen (samme tabell som e-post/SMS-verifisering og passord-reset).

| Felt | Beskrivelse |
|------|-------------|
| `LoginMfaCode` | 6-sifret kode (nullstilles etter bruk) |
| `LoginMfaCodeExpiresAt` | Utløpstidspunkt (60 min) |
| `LoginMfaCodeFailedAttempts` | Forsøksteller (nullstilles ved ny kode) |
| `LastLoginMfaCodeSentAt` | Tidspunkt for siste sending |

### Kode-generering (`VerificationInfoService.GenerateLoginMfaCodeAsync`)
- Kryptografisk sikker 6-sifret kode via `RandomNumberGenerator.GetInt32(100000, 1000000)`
- Utløper etter `VerificationConfig.EmailCodeExpiryMinutes` (60 min)
- Lagres ukryptert — samme mønster som alle andre koder i `VerificationInfo`

### Kode-validering (`VerificationInfoService.ValidateLoginMfaCodeAsync`)
- Sjekker `LoginMfaCodeFailedAttempts` mot `VerificationConfig.MaxFailedAttempts` (5)
- Sjekker utløp
- Ved riktig kode: nullstiller kode, expiry og forsøksteller
- Kaller `SaveChangesAsync` direkte — **ikke** via transaksjon (se [login.md](login.md) for begrunnelse)

### `ValidateSecurityAlertTokenAsync` — nødbremsen
MFA-sloten nullstilles automatisk hvis brukeren rapporterer uautorisert endring via "This wasn't me"-lenken.

### Feilkoder
| AppErrorCode | Verdi | Situasjon |
|---|---|---|
| `InvalidCode` | 4000 | Feil kode tastet inn |
| `ExpiredCode` | 4001 | Koden er utløpt (60 min) |
| `TooManyRequests` | 1006 | 5 feilede forsøk |
| `Unauthorized` | 1003 | Ukjent e-post |

---

## Frontend

### Filer
- `features/auth/screens/LoginMfaScreen.tsx` — View
- `features/auth/hooks/useLoginMfa.ts` — ViewModel
- `features/auth/services/authService.ts` — `verifyMfaCode()` + `mapMfaError()`
- `core/auth/authServiceNative.ts` — `verifyMfa()` — HTTP-kall + Keychain-lagring

### Skjerm
- Mørk navbar-header med `shield-checkmark`-ikon, tittel "Bekreft innloggingen" og e-postadressen
- Tilbake-knapp → `navigation.navigate("Login")`
- 6-sifret numerisk input med stor font og letter-spacing, `autoFocus`
- "Bekreft kode"-knapp — disabled til 6 siffer er tastet
- "Prøv igjen"-knapp med 60-sekunders cooldown

### Hook (`useLoginMfa`)
```typescript
const { code, setCode, isLoading, resendCooldown, handleVerify, handleResend } = useLoginMfa(email);
```

**`handleVerify`:**
1. Kaller `verifyMfaCode(email, code)`
2. Ved suksess: kaller `login(accessToken, refreshToken)` i `AuthContext` → setter `isLoggedIn = true`
3. Tokens er allerede lagret i Keychain av `authServiceNative.verifyMfa` — `AuthContext.login` setter kun state
4. Ved feil: toast med feilmelding, kode-felt nullstilles

**`handleResend`:**
- Navigerer tilbake til `Login` — brukeren må taste passord på nytt
- Dette er bevisst: vi ønsker ikke et eget resend-endepunkt uten passord-autentisering
- Cooldown starter på 60 sekunder ved mount (ned fra 120 på andre skjermer — koden utløper uansett etter 60 min)

### Feilmapping (`mapMfaError`)
```typescript
case AppErrorCode.InvalidCode:
case AppErrorCode.ExpiredCode:
  return Result.fail(error.message, AuthErrorCode.Unknown);
  // Viser backend-melding direkte i toast

case AppErrorCode.TooManyRequests:
  return Result.fail("Too many failed attempts. Please log in again.", AuthErrorCode.RateLimited);
```

### Navigasjon
```
LoginScreen (steg 1 suksess)
  → navigation.navigate → LoginMfaScreen { email }

LoginMfaScreen (steg 2 suksess)
  → login(accessToken, refreshToken)
  → isLoggedIn = true
  → Stack.Navigator bytter til innlogget-treet → MessagesScreen

LoginMfaScreen ("Prøv igjen" etter cooldown)
  → navigation.navigate → Login
```

### Route-params
```typescript
{ email: string }
```
