# ActivityFinder

Ende-til-ende kryptert meldingsapp. React Native + .NET 10 + PostgreSQL + Redis.

## Pågående arbeid

**Refaktorering backend:** By-Layer → Vertical Slice Architecture (By-Feature)

Gjøremål: Opprette endepunkt for å akseptere og avslå en Pending Conversation Request

## Kommandoer

```bash
# Backend (AFBack)
cd AFBack
dotnet run                              # Dev server
dotnet ef migrations add MigrationName  # Ny migration
dotnet ef database update               # Kjør migrations
dotnet test                             # Kjør tester

# Frontend (AFMobile)
cd AFMobile
npm start                               # Dev server
npx expo start                          # Expo dev
```

## Kritiske regler

**Krypteringsgrense:** Backend lagrer KUN kryptert data. Dekrypter ALDRI i backend.

**Transaksjonsmønster:** Commit database FØRST, deretter SignalR/Notifications.

**Cache-invalidering:** Invalider `CanSend` cache ved accept/block/archive/leave.

## Dokumentasjon

Se @AFBack/CLAUDE.md for backend-arkitektur og patterns  
Se @AFBack/.claude/rules/ for domenespesifikke regler (når opprettet)

## Notater

- Norske kommentarer i kode, engelske API-navn
- Tester må oppdateres etter refactoring
- CI/CD: GitHub Actions (workflows i .github/workflows/)