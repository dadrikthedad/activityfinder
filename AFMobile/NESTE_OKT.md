# AFMobile — Neste økt

## Status ved slutt av forrige økt

### Ferdig disse øktene
- `react-hook-form` + `zod` — skjemavalidering installert og integrert
- Login migrert til rhf+zod (`useLogin`, `LoginScreen`, `schemas.ts`)
- `signUpService`, `verificationService`, `baseService` → Result-pattern + JSDoc
- `useRegisterUser` → fjernet try/catch, typed RegistrationErrorCode
- **Tema-system** — `react-native-unistyles` v3.1.1 (pinnet)
- **Globalisering** — `i18next` + `react-i18next` + `expo-localization`
- **ProblemDetails-håndtering** — `ApiError` med HTTP-statuskode, `throwProblemDetails()`
- **Tokens lagres i Keychain** (ikke AsyncStorage), migrasjon fra AsyncStorage ved første oppstart
- **Komplett auth-flyt testet og fungerende:**
  - Signup → e-postverifisering → SMS-verifisering → Login → Home
  - Login med uverifisert e-post → VerificationScreen
  - Login med uverifisert telefon → PhoneSmsVerificationScreen
  - Login med feil credentials → feilmelding
- **PhoneSmsVerificationScreen** — ny skjerm, samme tema som VerificationScreen
- **SMS-endepunkter bruker email** (ikke phoneNumber) — backend slår opp internt
- **Signup telefonnummer** — landskode-picker (pill) med auto-forslag fra valgt land
  - `core/data/phoneDialCodes.ts` — ~200 land, ISO → { dialCode, flag }
  - `useCountryAndRegion` eksponerer `dialCode`, auto-oppdateres ved landvalg
- **userId er string (GUID)** — `AuthContext`, `getUserIdFromToken` returnerer string, ikke number
- **`baseService.parseJsonIfPresent`** — håndterer void-endepunkter med tom body
- **Zod-schemas** matcher Identity-regler i AFBack (min 8 tegn)

### Auth-flyt — teststatus
- ✅ Signup — fungerer, e-post snapshotter riktig via `registeredEmailRef`
- ✅ E-post verifisering — navigerer til PhoneSmsVerificationScreen
- ✅ SMS verifisering — navigerer til Login med `fromVerification: true`-banner
- ✅ Login med verifisert konto — tokens i Keychain, navigerer til Home
- ✅ Login med uverifisert e-post — navigerer til VerificationScreen
- ✅ Login med uverifisert telefon — navigerer til PhoneSmsVerificationScreen
- ✅ Login med feil credentials — viser feilmelding via toast
- ⏳ **Logout** — ikke testet ennå
- ⏳ **Reset password** — ikke testet ennå

---

## Gjøremål neste økt — i rekkefølge

### Steg 3c — Gjenstående auth-tester
1. **Logout** — logg ut, sjekk at tokens slettes fra Keychain og at appen navigerer til Login
2. **Reset password** — gå gjennom hele flyten (send e-post → kode → nytt passord)

### Steg 3b — Tema-gjennomgang av gjenværende skjermer
Mange skjermer utenfor `features/auth/` har fortsatt hardkodede farger og mangler tema-støtte.
Gå gjennom én etter én og migrer til `useUnistyles()`. Prioriter:
- `ResetPasswordScreen` — sjekk at den følger nytt tema
- Alle komponenter i `components/common/` som ikke er migrert ennå

### Steg 4 — Migrer features/messages/ til Feature Slice-arkitektur — VENT MED DENNE
Messaging er kritisk og må gjøres manuelt med Claude.
```
features/messages/
  screens/
  hooks/
  services/   ← Result-pattern
  models/     ← DTOer
```
Bruk `FlashList` i stedet for `FlatList` fra start.
Bruk `date-fns` for tidsstempler i meldinger.

### Steg 6 — Over-engineering og oppryddingsgjennomgang

**Kandidat 1 — `useConversationUpdate` er en unødvendig wrapper (ikke startet)**
`hooks/common/useConversationUpdate.ts` inneholder én funksjon som bare videresender til
`refreshConversationFromBackend()`. Ingen state, ingen logikk. Alle kallsteder kan importere
utility-funksjonen direkte.

**Kandidat 3 — `useGetDeletedConversations` og `useGetRejectedConversations` er identiske (ikke startet)**
Begge hooks er nøyaktig samme kode, bare ulike service-funksjoner og variabelnavn.

**Kandidat 4 — `useMessageNotifications` har `loading` i dependency-array (ikke startet)**
Fix: fjern `loading` fra dependency-arrayen og bruk en `useRef` for å garde mot parallelle kall.

**Kandidat 5 — `useBootstrap` eksponerer for mye data (ikke startet)**
Bør gjennomgås: hva bruker faktisk `useBootstrap`, og hvilke returnerte verdier kan fjernes?

### Steg 7 (fremtidig) — Push-varsler
Sett opp `expo-notifications` ETTER at in-app notifikasjonssystemet er ferdig.

---

## Hurtigreferanse — all installert infrastruktur

### Tema
```tsx
const { theme } = useUnistyles();
color: theme.colors.primary          // gull (#D4A017) i begge temaer
backgroundColor: theme.colors.background
// ALDRI: hardkodede farger
```

### ProblemDetails / API-feil
```typescript
import { throwProblemDetails, ApiError } from "@/core/errors/ProblemDetails";

// I fetch-kall:
if (!response.ok) {
  await throwProblemDetails(response); // kaster ApiError med status + detail
}

// I mapXxxError — bruk statuskode, IKKE string-matching:
if (error instanceof ApiError) {
  switch (error.status) {
    case 401: ...
    case 422: ... // DataAnnotations-valideringsfeil
    case 429: ...
  }
}
```

### Result-pattern
```tsx
const result = await loginUser(email, password);
if (!result.success) {
  switch (result.code) {
    case AuthErrorCode.InvalidCredentials: ...
    case AuthErrorCode.EmailNotVerified: ...
    case AuthErrorCode.PhoneNotVerified: ...
  }
  return;
}
// result.data er type-safe her
```

### Globalisering
```tsx
const { t } = useTranslation();
t("auth.login")
t("auth.resendIn", { time: "1:30" })
// ALDRI: hardkodet tekst
```

### Datoformatering
```tsx
import { format, formatDistanceToNow, isToday } from "date-fns";
import { nb, enUS } from "date-fns/locale";
const locale = language === "no" ? nb : enUS;
format(date, "HH:mm", { locale })
```

### Tidformatering (nedtelling)
```tsx
import { formatTime } from "@/utils/formatTime";
formatTime(90) // → "1:30"
```

### Lister
```tsx
import { FlashList } from "@shopify/flash-list";
<FlashList data={items} renderItem={({ item }) => <Item data={item} />} keyExtractor={(item) => item.id} />
```

### Kjøre lokalt
```bash
# Backend
cd C:\Users\fredr\ActivityFinder\AFBack && dotnet run

# Frontend (JS-endringer)
cd C:\Users\fredr\ActivityFinder\AFMobile && npx expo start --clear

# Frontend (ny native pakke installert)
npx expo run:android
```
