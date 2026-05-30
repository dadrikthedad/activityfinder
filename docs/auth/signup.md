# Signup

## Oversikt

Registreringsflyten oppretter ny bruker med profil og innstillinger, sender verifiserings-e-post, og navigerer til e-postverifisering.

---

## Backend

### Endepunkt
`POST /api/auth/signup` — `[AllowAnonymous]`, rate limit: `Auth`-policy

### Request
```json
{
  "email": "user@example.com",
  "password": "MyPassword1",
  "firstName": "Ola",
  "lastName": "Nordmann",
  "phoneNumber": "+4799428069",
  "countryCode": "NO",
  "dateOfBirth": "1990-01-15"
}
```

### Respons
```json
{ "userId": "83fc2f4b-...", "emailSent": true }
```

### Flyt (`AuthService.SignupAsync`)

1. **Rate limit** — `CheckEmailRateLimitAsync` på `EmailType.Verification`
2. **E-post-duplikat** — `FindByEmailAsync`. Hvis funnet → `SuspiciousActivity`-rapport + `Conflict`
3. **Telefon-duplikat** — `FindByPhoneAsync`. Hvis funnet → `SuspiciousActivity`-rapport + `Conflict`
4. **Transaksjon:**
   - Opprett `AppUser` med `UserProfile`, `UserSettings` og tom `VerificationInfo`
   - `CreateAsync` med passord via Identity
   - `AddToRoleAsync` → `User`-rolle
   - `GenerateEmailVerificationAsync` — generer 6-sifret kode
   - `emailService.SendAsync` — send verifiserings-e-post. Hvis feil → `Failure` → rollback
   - `RegisterEmailSent` — registrer i rate limit
5. **TimingGuard** — minimum 500ms responstid

### Passordregler (Identity)
- Minimum 8 tegn
- Krever stor bokstav, liten bokstav og tall
- Maks 128 tegn
- Matcher `resetPasswordSchema` i frontend (zod)

### Feilkoder
| AppErrorCode | Verdi | Situasjon |
|---|---|---|
| `Conflict` | 1002 | E-post eller telefon allerede registrert |
| `InvalidRegistrationData` | 3001 | Identity-valideringsfeil |
| `InternalError` | 1005 | Klarte ikke sende verifiserings-e-post |
| `TooManyRequests` | 1006 | Rate limit nådd |

---

## Frontend

### Filer
- `features/auth/screens/SignupScreen.tsx` — View
- `features/auth/hooks/useRegisterUser.ts` — ViewModel
- `features/auth/services/signUpService.ts` — API-kall + feilmapping
- `features/auth/components/SignUpNameFieldsNative.tsx` — Fornavn/etternavn
- `features/auth/components/SignUpContactFieldsNative.tsx` — E-post + telefon med landskode-picker
- `features/auth/components/SignUpPasswordSimpleFieldNative.tsx` — Passord + bekreft
- `features/auth/components/SignUpCountryFieldNative.tsx` — Landvelger
- `components/common/DatePickerNative.tsx` — Fødselsdato

### Skjerm
- `AppHeader` med tittel "Registrer deg", subtitle, og tilbake-pil → `navigation.reset` til Login
- Skjema i `ScrollView` med `KeyboardAvoidingView`
- Alle felt bruker `useFormHandlers` (ikke rhf — eget valideringssystem for signup)
- Submit via `handleSubmitNative` som validerer alle felt og setter `touchedFields`

### Telefonnummer — landskode-picker
`SignUpContactFieldsNative` har innebygd landskode-pill foran nummeret.
- Auto-forslag fra valgt land via `useCountryAndRegion` → `core/data/phoneDialCodes.ts`
- Brukeren kan overstyre
- Fullt internasjonalt nummer lagres i `formData.phone` (f.eks. `+4799428069`)

### Navigasjon etter signup
```
Signup (success)
  → toast "Konto opprettet!"
  → 1500ms delay
  → navigation.reset → VerificationScreen { email, fromRegistration: true }
```

**Viktig:** `registeredEmailRef.current` snapshotter e-posten FØR `useRegisterUser` nullstiller skjemaet. `formData.email` er allerede `""` når `isRegistered`-effecten kjører.

### Feilhåndtering
- Generelle feil → toast via `setMessage` / `errors["general"]`
- Feltnivå-feil → vises under hvert felt via `errors[fieldName]`
- Feilmapping bruker `error.appCode` via `mapRegistrationError`
