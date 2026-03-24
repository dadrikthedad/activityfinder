# AFMobile

React Native / Expo mobilapp for ActivityFinder. Ende-til-ende kryptert meldingsapp.

## Tech stack

- **React Native** 0.79 + **Expo** 53 — New Architecture aktivert (påkrevd av Unistyles)
- **TypeScript**
- **Zustand** — global state management (med persist via AsyncStorage)
- **NativeWind** — Tailwind CSS for React Native
- **React Navigation** — navigasjon (Stack)
- **expo-dev-client** — custom dev build (ikke Expo Go)
- **react-native-keychain** — sikker token-lagring (Keystore/Secure Enclave)
- **react-native-sodium / react-native-quick-crypto** — E2EE kryptografi
- **react-hook-form + zod** — skjemavalidering
- **react-native-unistyles 3.1.1** — tema-system (lyst/mørkt), pinnet versjon
- **react-native-nitro-modules 0.35.2** — påkrevd av unistyles, pinnet versjon
- **i18next + react-i18next + expo-localization** — globalisering (norsk/engelsk)
- **date-fns** — datoformatering med i18n-støtte
- **@shopify/flash-list** — høyytelseslister (erstatter FlatList)

## Kommandoer

```bash
npx expo run:android           # Bygg og installer på tilkoblet Android-enhet (kreves ved nye native pakker)
npx expo start --clear         # Start Metro med cache-reset (tilstrekkelig for JS-endringer)
adb devices                    # Verifiser at enhet er koblet til
adb reverse tcp:8081 tcp:8081  # Tunneling hvis Metro ikke kobler til enhet
adb uninstall com.dadrikthedad.AFMobile  # Avinstaller hvis signaturkonflikt
```

**Når trengs `expo run:android` vs `expo start`?**
- `expo run:android` — når nye pakker med native kode er installert (Unistyles, Nitro, Keychain osv.)
- `expo start --clear` — ved alle JS/TS-endringer, nye rene JS-pakker (i18next, date-fns, flash-list)

## Nåværende mappestruktur

```
AFMobile/
├── core/
│   ├── api/
│   │   ├── routes.ts               # Alle API-URL-er (ApiRoutes)
│   │   └── baseService.ts          # HTTP-metoder — bruker throwProblemDetails()
│   ├── auth/
│   │   └── authServiceNative.ts    # Token-håndtering (Keychain), fetchWithAuth
│   ├── data/
│   │   └── phoneDialCodes.ts       # ISO-kode → { dialCode, flag } for signup
│   ├── errors/
│   │   ├── ErrorCode.ts            # AuthErrorCode, RegistrationErrorCode, VerificationErrorCode, PasswordResetErrorCode
│   │   ├── Result.ts               # Result<T, C> og VoidResult<C>
│   │   ├── AppError.ts             # AppError-klasse for uventede tekniske feil
│   │   └── ProblemDetails.ts       # ProblemDetails-interface, ApiError (med appCode), throwProblemDetails(), getProblemDetail()
│   ├── models/                     # Delte DTOer som brukes på tvers av features
│   │   ├── DeviceInfoRequest.ts    # Device-info DTO
│   │   └── TokenResponse.ts        # Token-respons DTO
│   ├── theme/
│   │   ├── colors.ts               # Råfarger (Palette) — gull/kull-svart/nøytrale
│   │   ├── themes.ts               # lightTheme, darkTheme, appThemes, ThemeName
│   │   └── unistyles.ts            # StyleSheet.configure() — importeres i App.tsx
│   └── i18n/
│       ├── locales/
│       │   ├── no.ts               # Norsk (standard)
│       │   └── en.ts               # Engelsk
│       ├── index.ts                # i18next-konfigurasjon + Expo-språkdeteksjon
│       └── i18next.d.ts            # TypeScript-typer for t()-kall
│
├── shared/
│   └── types/
│       └── error/
│           └── AppErrorCode.ts     # Speil av AppErrorCode.cs i AFBack — delt kontrakt
│
├── features/
│   └── auth/                       # Feature Slice
│       ├── screens/                # LoginScreen, SignupScreen, VerificationScreen,
│       │                           #   PhoneSmsVerificationScreen, ResetPasswordScreen, CryptationScreen
│       ├── hooks/                  # useLogin (rhf+zod), useRegisterUser, useResetPassword (rhf+zod)
│       ├── services/               # authService, signUpService, verificationService
│       │                           #   — alle bruker Result-pattern + AppErrorCode-matching
│       ├── models/
│       │   ├── LoginRequestDTO.ts
│       │   ├── LoginResponseDTO.ts
│       │   ├── RegisterUserPayloadDTO.ts
│       │   ├── RegisterResponseDTO.ts
│       │   ├── RefreshTokenRequestDTO.ts
│       │   └── schemas.ts              # Zod-schemas: loginSchema, resetPasswordSchema
│       └── components/             # SignUp-feltkomponenter inkl. SignUpContactFieldsNative (med landskode-picker)
│
├── plugins/
│   └── withAndroidxCoreResolution.js  # Expo config plugin — tvinger androidx.core til 1.15.0
├── store/
│   ├── useThemeStore.ts            # Persistert temavalg
│   ├── useLanguageStore.ts         # Persistert språkvalg
│   └── ...
├── components/
│   ├── common/
│   │   ├── FormFieldNative.tsx     # useUnistyles()
│   │   ├── PasswordFieldNative.tsx # useUnistyles() — støtter tooltip og labelAlign
│   │   ├── DatePickerNative.tsx    # useUnistyles()
│   │   └── buttons/
│   │       ├── ButtonNative.tsx        # useUnistyles() — alle varianter
│   │       ├── LabelWithTooltipNative.tsx  # useUnistyles()
│   │       └── TooltipButtonNative.tsx     # useUnistyles()
│   └── settings/
│       ├── ThemeSelector.tsx
│       └── LanguageSelector.tsx
├── context/                        # AuthContext (userId er string/GUID, ikke number), ModalContext osv.
├── hooks/                          # Delte hooks
└── assets/
    ├── images/
    │   ├── SparksLogoTransparant.png   # Hovedlogo (transparent bakgrunn)
    │   └── ...
    ├── icon.png                    # App-ikon (1024x1024, solid bakgrunn)
    ├── adaptive-icon.png           # Android adaptive icon (1024x1024, transparent)
    ├── splash-icon.png             # Splash screen (1024x1024, transparent)
    └── favicon.png                 # Web favicon
```

## Arkitekturmønster

### Fil-organisering — regler

**Én ting per fil.** En fil skal ha ett klart ansvar:
- Interface/DTO → egen fil (`LoginRequestDTO.ts`)
- Delte modeller som brukes av flere features → `core/models/`
- Feature-spesifikke modeller → `features/{feature}/models/`

### AppErrorCode — delt domenekode mellom backend og frontend

Backend sender alltid `AppProblemDetails` ved feil via `BaseController.HandleFailure`.
`AppProblemDetails` er et utvidet `ProblemDetails`-objekt med et ekstra `code`-felt (int).

```json
{ "status": 401, "title": "Authentication Error", "detail": "Email address is not yet verified.", "code": 2002 }
```

Frontend leser `code`-feltet via `ApiError.appCode` og switcher på det i `mapXxxError`-funksjoner.
`AppErrorCode`-enumen i `shared/types/error/AppErrorCode.ts` er et nøyaktig speil av `AppErrorCode.cs` i AFBack.

```typescript
import { AppErrorCode } from "@shared/types/error/AppErrorCode";

// I mapXxxError — switch på appCode, IKKE error.status eller string-matching:
if (error instanceof ApiError) {
  switch (error.appCode) {
    case AppErrorCode.EmailNotConfirmed:   // 2002
      return Result.fail(error.message, AuthErrorCode.EmailNotVerified);
    case AppErrorCode.PhoneNotConfirmed:   // 2003
      return Result.fail(error.message, AuthErrorCode.PhoneNotVerified);
    case AppErrorCode.InvalidCredentials:  // 2000
      return Result.fail("Wrong email or password.", AuthErrorCode.InvalidCredentials);
    case AppErrorCode.TooManyRequests:     // 1006
      return Result.fail(error.message, AuthErrorCode.RateLimited);
  }
}
```

`GlobalExceptionHandler` returnerer standard `ProblemDetails` uten `code` for uventede exceptions.
I slike tilfeller er `error.appCode === AppErrorCode.Unknown` (0).

### ProblemDetails og ApiError

```typescript
// core/errors/ProblemDetails.ts — bruk alltid disse:
import { throwProblemDetails, ApiError } from "@/core/errors/ProblemDetails";
import { AppErrorCode } from "@shared/types/error/AppErrorCode";

// I fetch-kall — kast ApiError med statuskode, melding og appCode:
if (!response.ok) {
  await throwProblemDetails(response);  // leser problem.code → ApiError.appCode
}

// ApiError har tre felt:
// error.message  — brukervendt melding fra detail-feltet
// error.status   — HTTP-statuskode (401, 422, 429 osv.)
// error.appCode  — domenespesifikk AppErrorCode (2002, 4000 osv.) — bruk DETTE i switch
```

**Aldri** bruk `errorData.message` — backend bruker `detail`, ikke `message`.
**Aldri** switch på `error.status` alene — bruk `error.appCode` for presise domenefeil.

### baseService — tom respons-håndtering

`postRequestPublic` og `getRequestPublic` bruker `parseJsonIfPresent()` internt.
Void-endepunkter (f.eks. `verify-email`, `resend-phone-verification`) returnerer `200 OK` med tom body —
`response.json()` ville krasje. `parseJsonIfPresent` returnerer `null` for tomme responser.

```typescript
// ALDRI kall response.json() direkte på void-endepunkter
// bruk alltid postRequestPublic<void, ...> — returnerer null ved tom body
await postRequestPublic<void, { email: string }>(ApiRoutes.verification.resend, { email });
```

### Result-pattern

Services returnerer `Result<T, ErrorCode>` i stedet for å kaste exceptions.
`mapXxxError`-funksjoner oversetter `AppErrorCode` (backend-kontrakt) til feature-spesifikke koder (`AuthErrorCode` etc.).

```typescript
// Service:
export async function loginUser(email, password): Promise<Result<LoginResponseDTO, AuthErrorCode>> {
  try {
    const data = await authServiceNative.login(email, password);
    return Result.ok(data);
  } catch (error) {
    return mapLoginError(error); // mapper AppErrorCode → AuthErrorCode
  }
}

// Hook — ingen try/catch, ingen string-matching:
const result = await loginUser(email, password);
if (!result.success) {
  switch (result.code) {
    case AuthErrorCode.EmailNotVerified:
      navigation.navigate("VerificationScreen", { email });
      break;
    case AuthErrorCode.PhoneNotVerified:
      navigation.navigate("PhoneSmsVerificationScreen", { email });
      break;
    case AuthErrorCode.InvalidCredentials:
      setError(result.error);
      break;
  }
  return;
}
await login(result.data.accessToken, result.data.refreshToken);
```

### Token-håndtering

Tokens lagres i **Keychain** (Android Keystore / iOS Secure Enclave) — aldri i AsyncStorage.
`authServiceNative` er en singleton som håndterer alt: lagring, refresh, proaktiv refresh-timer.

```typescript
// ALDRI:
await AsyncStorage.setItem('accessToken', token);

// ALLTID via authServiceNative:
await authServiceNative.login(email, password);  // lagrer automatisk i Keychain
await authServiceNative.logout();                // sletter fra Keychain
```

### Auth-navigasjonsflyt

Fullstendig flyt testet og fungerende:

```
Signup
  → VerificationScreen          (e-post — kode sendt automatisk av backend ved signup)
    → PhoneSmsVerificationScreen (SMS — kode sendes automatisk ved mount)
      → Login { fromVerification: true }  (grønt banner: "Kontoen din er klar!")
        → Home                  (etter vellykket innlogging)

Login med uverifisert e-post:
  → backend returnerer AppErrorCode.EmailNotConfirmed (2002)
  → VerificationScreen

Login med uverifisert telefon:
  → backend returnerer AppErrorCode.PhoneNotConfirmed (2003)
  → PhoneSmsVerificationScreen  (sender SMS én gang til ved mount — backend rate limit hindrer dobbelsending)

Login med feil credentials:
  → backend returnerer AppErrorCode.InvalidCredentials (2000)
  → feilmelding via toast
```

**Viktig:** Begge SMS/e-post-endepunkter bruker `email` som identifikator (ikke `phoneNumber`).
Backend slår opp telefonnummer internt fra e-post.

```typescript
// verificationService.ts — alle fire funksjoner tar email:
verifyEmailWithCode(email, code)    // POST /api/verification/verify-email
resendVerificationEmail(email)      // POST /api/verification/resend-verification
verifySmsCode(email, code)          // POST /api/verification/verify-phone
resendSmsVerification(email)        // POST /api/verification/resend-phone-verification
```

### ViewModel-mønster

```
LoginScreen.tsx        →  View       (kun JSX, ingen logikk)
useLogin.ts            →  ViewModel  (state, rhf+zod, actions)
useResetPassword.ts    →  ViewModel  (steg 1+2: lokal state, steg 3: rhf+zod)
authService.ts         →  Model      (API-kall, returnerer Result<T>)
LoginResponseDTO.ts    →  DTO        (typedefinisjoner)
```

### Passordfelt — PasswordFieldNative

Én felles passordfelt-komponent for hele appen: `components/common/PasswordFieldNative.tsx`.
Støtter `tooltip` (viser `LabelWithTooltipNative`) og `labelAlign` ("left" for signup, "center" for login/reset).

```typescript
// Login / ResetPassword — sentrert label, ingen tooltip:
<PasswordFieldNative id="password" label={t("auth.password")} value={value} ... />

// Signup — venstrejustert label med tooltip:
<PasswordFieldNative id="password" label={t("auth.createPassword")} tooltip={t("auth.passwordTooltip")} labelAlign="left" value={value} ... />
```

### Signup — telefonnummer med landskode

`SignUpContactFieldsNative` har innebygd landskode-picker (pill foran nummeret).
Landskoden auto-foreslås fra valgt land via `useCountryAndRegion` → `core/data/phoneDialCodes.ts`.
Brukeren kan overstyre. Fullt internasjonalt nummer lagres i `formData.phone` (f.eks. `+4799428069`).

```typescript
// useCountryAndRegion eksponerer dialCode:
const { countries, countryCodes, dialCode } = useCountryAndRegion({ country, setFormData, editing: true });
// dialCode = { dialCode: "+47", flag: "🇳🇴" } — oppdateres automatisk ved landvalg
```

### Zod-schemas — passordregler

Matcher Identity-konfigurasjon i AFBack (`RequireDigit/Lower/Upper = true`, `RequiredLength = 8`, maks 128):

```typescript
// loginSchema: min 8 tegn (ingen regex — backend gir presis feilmelding ved feil credentials)
// resetPasswordSchema: 8-128 tegn + regex for stor/liten bokstav + tall
// Begge brukes med react-hook-form + zodResolver i useLogin og useResetPassword
```

### Tema — react-native-unistyles v3.1.1

Fargeidentitet: **gull (#D4A017) + kull-svart (#1A1A1A)** — ingen grønt som primærfarge.

```typescript
import { useUnistyles } from "react-native-unistyles";
const { theme } = useUnistyles();

// ALDRI hardkodede farger:
color: theme.colors.primary          // ✅ gull
color: "#D4A017"                     // ❌

// Tokens:
theme.colors.primary / primaryDark / primaryLight / onPrimary
theme.colors.accent / accentLight / accentDark
theme.colors.background / backgroundAlt / backgroundInput
theme.colors.surface / surfaceAlt / surfaceInverse
theme.colors.textPrimary / textSecondary / textMuted / textDisabled / textPlaceholder
theme.colors.border / borderFocus / borderError
theme.colors.error / warning / success / info
theme.colors.disabled / disabledText
theme.colors.navbar / navbarText
theme.spacing.xs/sm/md/lg/xl/xxl     // 4/8/16/24/32/48
theme.radii.sm/md/lg/full            // 4/8/16/9999
theme.typography.xs/sm/md/lg/xl/xxl  // 12/14/16/18/24/32
theme.typography.regular/medium/semibold/bold

// Bytte tema (trigger app-restart):
const { setTheme } = useThemeStore();
setTheme("dark");
```

### Globalisering — i18next

```typescript
import { useTranslation } from "react-i18next";
const { t } = useTranslation();

t("auth.login")                          // ✅
"Logg inn"                               // ❌ aldri hardkodet

// Bytte språk (umiddelbart, ingen restart):
const { setLanguage } = useLanguageStore();
setLanguage("en");
```

### Datoformatering — date-fns

```typescript
import { format, formatDistanceToNow, isToday, isYesterday } from "date-fns";
import { nb, enUS } from "date-fns/locale";
const locale = language === "no" ? nb : enUS;
format(date, "HH:mm", { locale })
formatDistanceToNow(date, { addSuffix: true, locale })
```

### Lister — @shopify/flash-list v2.3.0

```typescript
import { FlashList } from "@shopify/flash-list";
<FlashList
  data={messages}
  renderItem={({ item }) => <MessageItem message={item} />}
  keyExtractor={(item) => item.id}
/>
```

## Kritiske regler

**Krypteringsgrense:** Backend lagrer KUN kryptert data. Dekrypter ALDRI i backend.

**Transaksjonsmønster (SignalR):** Backend committer DB først, deretter SignalR.

**Token-håndtering:** Tokens lagres via `authServiceNative` i Keychain — aldri direkte i AsyncStorage.

**Result-pattern:** Services returnerer `Result<T, ErrorCode>` — ikke kast exceptions for forretningsfeil.

**AppErrorCode:** Backend sender alltid `AppProblemDetails` med `code`-felt. Bruk `error.appCode` i alle `mapXxxError`-funksjoner — ALDRI `error.status` alene eller string-matching på meldingstekst. `AppErrorCode`-enumen i `shared/types/error/AppErrorCode.ts` er kontrakten — hold den synkronisert med AFBack.

**ProblemDetails:** Backend bruker `detail`-feltet, ikke `message`. Les aldri `errorData.message`.

**Tema:** ALDRI hardkodede farger. Alltid `theme.colors.*` fra `useUnistyles()`.
Unntak: absolutt svart/hvit i mediaviser, `rgba(0,0,0,x)` overlays, tredjeparts komponenter.

**Globalisering:** ALDRI hardkodede brukervendte strenger. Alltid `t("nøkkel")` fra `useTranslation()`.

**Fil-organisering:** Én ting per fil. Delte modeller i `core/models/`, feature-spesifikke i `features/{feature}/models/`.

**Modeller:** ALDRI opprett nye modeller eller legg til egenskaper uten eksplisitt bekreftelse fra Magee.

**Kommentarer:** Norske kommentarer i kode, engelske identifikatorer og API-navn.

**Pinnede pakker:** `react-native-unistyles` og `react-native-nitro-modules` er pinnet uten `^`.
Ikke oppdater disse uten å sjekke kompatibilitetstabellen først.

## Android-bygg — kjente problemer

**`androidx.core` versjonskkonflikt** — `react-native-keychain` v10 trekker inn `androidx.core:1.17.0`
som krever AGP 8.9.1 og compileSdk 36. Løst via Expo config plugin:
`plugins/withAndroidxCoreResolution.js` — tvinger `androidx.core` til 1.15.0.
Overlever `expo prebuild --clean` automatisk.

## API-konfigurasjon

```typescript
// Miljøstyring via .env.local
API_URL=http://192.168.1.191:5058   // lokal utvikling (fysisk enhet)

// Android emulator: http://10.0.2.2:5058
// Produksjon: https://activityfinder-gnaacbg9gsgjh7b7.swedencentral-01.azurewebsites.net
```

## Gotchas

- **Første bygg / ny native pakke:** `npx expo run:android` tar 10–15 min
- **Signaturkonflikt:** `adb uninstall com.dadrikthedad.AFMobile`
- **Metro + fysisk enhet:** `adb reverse tcp:8081 tcp:8081`
- **expo-dev-client:** Kan ikke åpnes i Expo Go
- **Unistyles API:** V3.1 bruker `StyleSheet.configure()` og `useUnistyles()` — ikke `UnistylesRegistry` eller `createStyleSheet`/`useStyles` (det var v2)
- **FlashList v2:** Krever ikke `estimatedItemSize`
- **AppProblemDetails:** Backend bruker `detail`-feltet og `code`-feltet. `code` er `AppErrorCode` som int. GlobalExceptionHandler sender standard ProblemDetails uten `code` — `error.appCode` er da `AppErrorCode.Unknown` (0).
- **Keychain service:** `AFMobile.auth` — én entry med JSON-streng for alle token-felt
- **userId er string (GUID):** `AuthContext.userId` er `string | null`, ikke `number | null`. `getUserIdFromToken` returnerer GUID-streng direkte — ikke kall `Number()` på den.
- **Void-endepunkter returnerer tom body:** `postRequestPublic` kaller `parseJsonIfPresent` — returnerer `null` for `200 OK` uten body. Ikke forvent JSON fra verify/resend-endepunkter.
- **SignupScreen email-snapshot:** `formData.email` er allerede nullstilt når `isRegistered`-effecten kjører. Bruk `registeredEmailRef.current` for å sende e-post til `VerificationScreen`.
- **AppErrorCode sync:** Når nye koder legges til i AFBack `AppErrorCode.cs`, må `shared/types/error/AppErrorCode.ts` oppdateres tilsvarende.
