# Bootstrap Feature

## Oversikt

Bootstrap gir frontend all nødvendig data ved app-oppstart, delt i to faser for raskest mulig tid til interaktiv app. Sync håndteres separat via `SyncEventController` og er ikke en del av bootstrap.

## Flyt

```
App starter
  │
  ├─ 1. GET /api/bootstrap/critical
  │     → Brukerdata, profil, innstillinger, venner, blokkerte
  │     → Frontend rendrer UI med én gang dette er mottatt
  │
  └─ 2. GET /api/bootstrap/secondary
        → Samtaler, meldinger, varsler, venneforespørsler
        → Frontend fyller inn resten av UI-et
        
Etter bootstrap:
  │
  ├─ 3. SignalR kobler til (sender deviceId i headers)
  │
  └─ 4. GET /api/syncevent/sync
        → Backend sjekker DeviceSyncState for enheten
        → Returnerer delta-events eller RequiresFullRefresh
```

## Critical Bootstrap

Hentes først — inneholder det som trengs for å rendre grunnleggende UI.

| Data | Kilde | Beskrivelse |
|------|-------|-------------|
| User | `IUserRepository` | Navn, profilbilde, e-post, verifiseringsstatus |
| Profile | `IUserRepository` | Lokasjon, demografi, bio, kontaktinfo (nullable) |
| Settings | `IUserRepository` | Språk, synlighetsinnstillinger, notifikasjoner |
| Friends | `IFriendshipService` | Liste med venner (UserSummaryDto) |
| BlockedUsers | `IBlockingService` | Brukere vi har blokkert |

User, Profile og Settings hentes i én query med Include. Friends og BlockedUsers kjøres parallelt.

## Secondary Bootstrap

Hentes etter critical — fyller inn samtaler, meldinger og varsler.

| Data | Kilde | Beskrivelse |
|------|-------|-------------|
| ActiveConversations | `IGetConversationsService` | Aksepterte samtaler (maks 10) |
| PendingConversations | `IGetConversationsService` | Mottatte samtaleforespørsler (maks 10) |
| ConversationMessages | `IMessageQueryService` | Meldinger for aktive + pending 1v1-samtaler (10 per samtale) |
| MessageNotifications | `IMessageNotificationQueryService` | Meldingsvarsler (maks 20) |
| Notifications | `INotificationService` | Appvarsler (maks 20) |
| PendingFriendshipRequests | `IFriendshipRequestService` | Mottatte venneforespørsler (maks 10) |
| UnreadMessageNotificationCount | `IMessageNotificationQueryService` | Antall uleste meldingsvarsler |
| UnreadNotificationCount | `INotificationService` | Antall uleste appvarsler |
| UnreadConversationIds | `IMessageNotificationQueryService` | Samtale-IDer med uleste meldinger |

### Parallellisering

**Fase 1** — Kjøres parallelt med `Task.WhenAll`:
- Aktive samtaler, pending samtaler, meldingsvarsler, appvarsler, venneforespørsler, ulest-tellere, uleste samtale-IDer

**Fase 2** — Kjøres sekvensielt etter fase 1:
- Meldinger hentes for aktive samtaler + pending 1v1-samtaler (ikke pending gruppesamtaler)

## Meldingshenting

Meldinger hentes via `GetMessagesForConversationsAsync` som batch-henter for flere samtaler i én operasjon. Pending gruppesamtaler ekskluderes siden brukeren ikke skal se meldinger der ennå.

## Sync vs Bootstrap

Bootstrap og sync er uavhengige systemer:

- **Bootstrap** gir en komplett snapshot av brukerens data ved oppstart
- **Sync** (via `SyncEventController`) gir delta-oppdateringer basert på `DeviceSyncState` per enhet
- Ved `RequiresFullRefresh` fra sync kjøres bootstrap på nytt
