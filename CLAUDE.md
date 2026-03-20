# ActivityFinder

Ende-til-ende kryptert meldingsapp. React Native (Expo) + .NET 10 + PostgreSQL + Redis.

## Prosjektstruktur

```
ActivityFinder/
├── AFBack/         # .NET 10 backend API
├── AFMobile/       # React Native / Expo mobilapp
├── shared/         # Delte TypeScript-typer (frontend/mobile)
└── activitynext/   # Next.js webfront (ikke aktiv)
```

## Kommandoer

```bash
# Backend
cd AFBack
dotnet run
dotnet watch run
dotnet ef migrations add MigrationName
dotnet ef database update
dotnet test

# Mobilapp
cd AFMobile
npx expo run:android           # Bygg og kjør på fysisk Android-enhet
npx expo start                 # Start Metro bundler (hot reload)
adb devices                    # Sjekk tilkoblet enhet
adb reverse tcp:8081 tcp:8081  # Tunneling hvis Metro ikke kobler
```

## Kritiske regler (gjelder hele prosjektet)

**Krypteringsgrense:** Backend lagrer KUN kryptert data. Dekrypter ALDRI i backend.

**Transaksjonsmønster:** Commit database FØRST, deretter SignalR/Notifications.

**Cache-invalidering:** Invalider `CanSend` cache ved accept/block/archive/leave.

**Modeller:** ALDRI opprett nye modeller eller legg til egenskaper uten eksplisitt bekreftelse fra Magee.

**Kommentarer:** Norske kommentarer i kode, engelske identifikatorer og API-navn.

## Dokumentasjon

Se @AFBack/CLAUDE.md for backend-arkitektur og patterns
Se @AFMobile/CLAUDE.md for mobilapp-arkitektur og patterns

## Pågående arbeid

- AFBack: Refaktorering til Vertical Slice Architecture (By-Feature)
- AFMobile: Refaktorering til Feature Slice-struktur + kobling mot ny lokal backend
- CI/CD: GitHub Actions planlagt (workflows i .github/workflows/)
