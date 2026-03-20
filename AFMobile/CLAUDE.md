# AFMobile

React Native / Expo mobilapp for ActivityFinder. Ende-til-ende kryptert meldingsapp.

## Tech stack

- **React Native** 0.79 + **Expo** 53
- **TypeScript**
- **Zustand** — global state management
- **NativeWind** — Tailwind CSS for React Native
- **React Navigation** — navigasjon (Stack)
- **expo-dev-client** — custom dev build (ikke Expo Go)
- **react-native-keychain** — sikker token-lagring
- **react-native-sodium / react-native-quick-crypto** — E2EE kryptografi

## Kommandoer

```bash
npx expo run:android        # Bygg og installer på tilkoblet Android-enhet
npx expo start              # Start Metro (hot reload etter første bygg)
adb devices                 # Verifiser at enhet er koblet til
adb reverse tcp:8081 tcp:8081  # Tunneling hvis Metro ikke kobler til enhet
adb uninstall com.dadrikthedad.AFMobile  # Avinstaller hvis signaturkonflikt
```

## Målarkitektur: Feature Slice

Refaktorering pågår fra lag-basert til feature-basert struktur (tilsvarer Vertical Slice i AFBack).

```
AFMobile/
├── core/                        # Delt infrastruktur (ikke feature-spesifikt)
│   ├── api/
│   │   ├── baseService.ts       # fetchWithAuth, HTTP-metoder
│   │   └── apiConfig.ts         # BASE_URL, miljøkonfigurasjon
│   ├── auth/
│   │   ├── AuthContext.tsx
│   │   ├── authServiceNative.ts
│   │   └── tokenUtils.ts
│   ├── errors/
│   │   ├── AppError.ts          # Typed feilklasser (tilsvarende AFBack)
│   │   └── errorHandler.ts
│   ├── store/                   # Zustand stores (global state)
│   │   ├── useChatStore.ts
│   │   ├── useNotificationStore.ts
│   │   └── useUserCacheStore.ts
│   ├── signalr/                 # SignalR infrastruktur
│   └── crypto/                  # E2EE, polyfills
│
├── features/
│   ├── auth/
│   │   ├── screens/             # LoginScreen, SignupScreen, VerificationScreen
│   │   ├── hooks/               # useLogin, useSignup
│   │   ├── services/            # authService
│   │   ├── models/              # LoginRequest, LoginResponse (DTOer)
│   │   └── components/          # Auth-spesifikke komponenter
│   ├── messages/
│   │   ├── screens/
│   │   ├── hooks/
│   │   ├── services/
│   │   ├── models/
│   │   └── components/
│   ├── profile/
│   ├── friends/
│   ├── notifications/
│   └── files/
│
├── shared/                      # Gjenbrukbare UI-komponenter og hooks
│   ├── components/
│   │   ├── FormField.tsx
│   │   ├── Button.tsx
│   │   └── Toast.tsx
│   └── hooks/
│       └── useFormState.ts
│
└── assets/
```

**Refaktoreringsrekkefølge:** `core/` → `features/auth/` → `features/messages/` → resten

## Arkitekturmønster

### ViewModel-mønster (Custom Hook som ViewModel)

Tilsvarer MVVM. Skjermen inneholder kun JSX, all logikk i hook:

```
LoginScreen.tsx   →  View       (kun JSX, ingen logikk)
useLogin.ts       →  ViewModel  (state, validering, actions)
authService.ts    →  Model      (API-kall)
LoginRequest.ts   →  DTO        (typedefinisjoner)
```

### Models / DTOer

Alle API-modeller skal ligge i `models/` per feature. Navnekonvensjon tilsvarer AFBack:

- **`Request`** — data fra app til backend (`LoginRequest`, `SendMessageRequest`)
- **`Response`** — data fra backend til app (`LoginResponse`, `ConversationResponse`)

```typescript
// features/auth/models/LoginRequest.ts
export interface LoginRequest {
    email: string;
    password: string;
}

// features/auth/models/LoginResponse.ts
export interface LoginResponse {
    accessToken: string;
    refreshToken: string;
}
```

### AppError — typed feilhåndtering

Bruk `AppError` i stedet for string-matching på feilmeldinger:

```typescript
// core/errors/AppError.ts
export enum ErrorCode {
    Unauthorized = "UNAUTHORIZED",
    NetworkError = "NETWORK_ERROR",
    ValidationError = "VALIDATION_ERROR",
    EmailNotVerified = "EMAIL_NOT_VERIFIED",
    RateLimited = "RATE_LIMITED",
}

export class AppError extends Error {
    constructor(
        public readonly code: ErrorCode,
        message: string,
        public readonly statusCode?: number
    ) {
        super(message);
        this.name = "AppError";
    }
}
```

Bruk i hooks:
```typescript
// Ikke dette:
if (error.message.includes('401')) { ... }

// Dette:
if (error instanceof AppError && error.code === ErrorCode.Unauthorized) { ... }
```

### API-konfigurasjon

```typescript
// core/api/apiConfig.ts
import Constants from "expo-constants";

export const ApiConfig = {
    baseUrl: Constants.expoConfig?.extra?.apiUrl
        ?? "https://activityfinder-gnaacbg9gsgjh7b7.swedencentral-01.azurewebsites.net",
    timeout: 10_000,
} as const;
```

Miljøvariabel settes i `app.config.ts` via `API_URL` i `.env.local`.
Lokal utvikling: `http://192.168.1.XX:5000` (PC-ens lokale IP, samme WiFi som enhet).
Android emulator: `http://10.0.2.2:5000`.

## Kritiske regler

**Krypteringsgrense:** Backend lagrer KUN kryptert data. Dekrypter ALDRI i backend. All kryptering skjer i `core/crypto/` eller `features/files/`.

**Transaksjonsmønster (SignalR):** Backend committer DB først, deretter SignalR. Ikke forvent garantert rekkefølge på SignalR-events.

**Token-håndtering:** Access token og refresh token lagres via `react-native-keychain`, aldri i AsyncStorage.

**Modeller:** ALDRI opprett nye modeller eller legg til egenskaper uten eksplisitt bekreftelse fra Magee.

**Kommentarer:** Norske kommentarer i kode, engelske identifikatorer og API-navn.

## Nåværende status (under refaktorering)

### Lag-basert struktur (gammel — fases ut)
```
screens/        → flyttes til features/[feature]/screens/
hooks/          → flyttes til features/[feature]/hooks/ eller shared/hooks/
services/       → flyttes til features/[feature]/services/
components/     → flyttes til features/[feature]/components/ eller shared/components/
```

### Hva som IKKE flyttes
- `store/` — Zustand stores forblir globale (ikke feature-spesifikke)
- `context/` — AuthContext flyttes til `core/auth/`
- `assets/` — forblir på rotnivå
- `constants/routes.ts` — erstattes av `core/api/apiConfig.ts`

## Gotchas

- **Første bygg:** `npx expo run:android` tar 10–15 min (Gradle + native compilation)
- **Signaturkonflikt:** Avinstaller appen med `adb uninstall com.dadrikthedad.AFMobile` hvis `INSTALL_FAILED_UPDATE_INCOMPATIBLE`
- **Metro + fysisk enhet:** Bruk `adb reverse tcp:8081 tcp:8081` hvis appen ikke kobler til Metro
- **expo-dev-client:** Appen bruker custom dev client, ikke Expo Go. Kan ikke åpnes i Expo Go.
- **Native modules:** `react-native-sodium`, `react-native-quick-crypto`, `react-native-keychain` krever native bygg — ingen web-støtte
- **Doble bilde-pickere:** Fjern `react-native-image-picker`, beholdt `expo-image-picker`
- **Doble filsystemer:** Vurder å erstatte `react-native-fs` med `expo-file-system`

## Neste steg

1. Sett opp `app.config.ts` + `.env.local` for lokal API-URL
2. Opprett `core/errors/AppError.ts`
3. Refaktorer `features/auth/` som første feature-slice
4. Koble auth-endepunkter mot ny lokal AFBack
5. Test alle auth-endepunkter (login, signup, verify, reset password)
6. Fortsett feature for feature
