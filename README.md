# ActivityFinder

Ende-til-ende kryptert meldingsapplikasjon med mobil- og webklient.

## Prosjektstruktur

```
ActivityFinder/
├── AFBack/         # .NET 10 backend API
├── AFMobile/       # React Native / Expo mobilapp (Android + iOS)
├── activitynext/   # Next.js webklient
├── AFBack.Tests/   # Backend-tester
├── shared/         # Delte TypeScript-typer (frontend/mobile)
├── infrastructure/ # Terraform / UpCloud-infrastruktur
└── docs/           # Prosjektdokumentasjon
```

## Tech stack

### Backend (AFBack)
- **.NET 10 / ASP.NET Core** — REST API med Vertical Slice Architecture
- **PostgreSQL** — hoveddatabase via Entity Framework Core
- **Redis** — caching (CanSend, UserSummary)
- **SignalR** — sanntidsmeldinger
- **Argon2id** — passordhashing
- **JWT** — access tokens (15 min) + opake refresh tokens (365 dager)
- **HashiCorp Vault** — secrets management
- **Docker** — containerisering

### Mobilapp (AFMobile)
- **React Native 0.79 / Expo 53** — New Architecture
- **TypeScript**
- **Zustand** — global state
- **NativeWind** — Tailwind CSS for React Native
- **react-native-unistyles 3.1.1** — tema-system (lyst/mørkt)
- **react-native-keychain** — sikker token-lagring (Keystore / Secure Enclave)
- **react-native-sodium** — E2EE kryptografi
- **react-hook-form + zod** — skjemavalidering
- **i18next** — globalisering (norsk/engelsk)
- **@shopify/flash-list** — høyytelseslister

### Webklient (activitynext)
- **Next.js 15** med App Router
- **React 19 / TypeScript**
- **Tailwind CSS**
- **Zustand** — global state
- **SWR** — data fetching
- **SignalR** — sanntidsmeldinger
- **Headless UI / Radix UI** — tilgjengelige komponenter

### Infrastruktur
- **UpCloud** — hosting (migrert fra Azure)
- **Terraform** — infrastruktur som kode
- **Brevo** — e-post
- **46elks** — SMS

## Kjernefeatures

- Ende-til-ende krypterte meldinger (backend dekrypterer aldri)
- 1-til-1 direktesamtaler med pending request-flyt (maks 5 meldinger før accept)
- Gruppesamtaler
- Vedlegg og reaksjoner
- Vennesystem med blokkering
- Sanntidskommunikasjon via SignalR
- Offline-synkronisering via SyncEvents
- Varslingssystem
- Støtte for norsk og engelsk

## Kritiske arkitekturregler

**Krypteringsgrense:** Backend lagrer KUN kryptert data. Aldri dekrypter i backend.

**Transaksjonsmønster:** Commit database først — deretter SignalR og SyncEvents.

**Cache-invalidering:** Invalider `CanSend`-cache ved accept, block, archive og leave.

## Kom i gang

### Backend
```bash
cd AFBack
dotnet run
dotnet watch run        # Hot reload
dotnet test             # Kjør tester
```

### Mobilapp
```bash
cd AFMobile
npx expo run:android    # Første bygg / ny native pakke (10-15 min)
npx expo start --clear  # Vanlig utvikling (JS-endringer)
adb reverse tcp:8081 tcp:8081  # Tunneling til fysisk enhet
```

### Webklient
```bash
cd activitynext
npm install
npm run dev
```

## Miljøvariabler

```bash
# AFMobile (.env.local)
API_URL=http://192.168.1.191:5058   # Lokal utvikling (fysisk enhet)
# API_URL=http://10.0.2.2:5058     # Android-emulator
```

Se `AFBack/CLAUDE.md` og `AFMobile/CLAUDE.md` for detaljert arkitekturdokumentasjon.
