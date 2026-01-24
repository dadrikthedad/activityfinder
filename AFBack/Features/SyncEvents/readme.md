# Sync System - Komplett Oversikt

## Overordnet Konsept

Systemet bruker **event-driven sync** med **per-device tracking** for å holde alle brukerens enheter oppdatert.

**To hoveddeler:**
1. **Real-time**: SignalR pusher events til aktive enheter
2. **Backup**: Sync endpoint henter events enheten har gått glipp av

---

##   Arkitektur
```
Backend Components:
├── SyncService (hovedlogikk)
├── SyncEventRepository (database operations)
├── DeviceSyncStateRepository (per-device state tracking)
└── Models:
    ├── SyncEvent (events som skal synkes)
    └── DeviceSyncState (track state per enhet)

Frontend Components:
├── useSync (koordinerer sync)
├── useDeltaSync (delta sync logic)
├── useSignalRMonitor (real-time events)
└── useFallbackSync (backup polling)
```

---

## Backend Flow: ValidateSyncForDeviceAsync

### Input
- `userId`: Bruker ID
- `userDeviceId`: Unik device ID (fra UserDevice-tabellen)

### Output
```csharp
public class SyncResponse
{
    public bool RequiresFullRefresh { get; set; }  // true = må gjøre full bootstrap
    public List<SyncEventDto> Events { get; set; } // Liste med events (tom hvis full refresh)
}
```

### Steg-for-steg
```
STEG 1: Hent/opprett DeviceSyncState
├─ Sjekk om device har synket før
├─ Hvis nei: Opprett ny DeviceSyncState
└─ Returner eksisterende state

STEG 2: Sjekk inaktivitet
├─ Hvis (TimeSinceLastSync > 7 dager)
│   ├─ Reset LastSyncedEventTime til null
│   └─ Return: RequiresFullRefresh = true
└─ Continue

STEG 3: Tell pending events
├─ sinceTimestamp = LastSyncedEventTime ?? DateTime.MinValue
├─ numberOfEvents = COUNT(*) WHERE CreatedAt > sinceTimestamp
└─ Log: "Device har X pending events"

STEG 4: Ingen events?
├─ Hvis numberOfEvents == 0
│   ├─ Oppdater LastSyncAt (behold LastSyncedEventTime)
│   └─ Return: RequiresFullRefresh = false, Events = []
└─ Continue

STEG 5: For mange events?
├─ Hvis numberOfEvents > 30 (threshold)
│   ├─ Reset LastSyncedEventTime til null
│   └─ Return: RequiresFullRefresh = true
└─ Continue

STEG 6: Hent events
├─ SELECT * WHERE CreatedAt > sinceTimestamp ORDER BY CreatedAt
├─ Re-serialize til camelCase
└─ Hvis 0 events returnert: CRITICAL ERROR (race condition)

STEG 7: Oppdater state
├─ LastSyncAt = DateTime.UtcNow
├─ LastSyncedEventTime = Max(events.CreatedAt)
└─ Return: Events
```

---

## Nøkkelkonsepter

### LastSyncAt vs LastSyncedEventTime

**LastSyncAt** = Når enheten sist kjørte sync (klokkeslett)
- Brukes til: Måle inaktivitet
- Oppdateres: Hver gang sync kjøres
- Eksempel: `14:30:00`

**LastSyncedEventTime** = Tidspunkt for nyeste event enheten har mottatt
- Brukes til: WHERE-clause i database query
- Oppdateres: Kun når events faktisk hentes
- Eksempel: `14:25:30` (timestamp fra siste event)

### Hvorfor begge?

**Problem uten LastSyncedEventTime:**
```
14:00:00.000 - Sync starter (LastSyncAt = 14:00:00)
14:00:00.100 - Query: WHERE CreatedAt > 13:50:00
14:00:00.200 - Ny event opprettet (CreatedAt = 14:00:00.200)
14:00:00.300 - Query ferdig (event ikke med)
14:00:00.400 - LastSyncAt = 14:00:00.400

Neste sync:
→ Query: WHERE CreatedAt > 14:00:00.400
→ Event med 14:00:00.200 går tapt! ❌
```

**Løsning med LastSyncedEventTime:**
```
14:00:00.400 - LastSyncedEventTime = 13:59:59 (nyeste event faktisk hentet)

Neste sync:
→ Query: WHERE CreatedAt > 13:59:59
→ Event med 14:00:00.200 inkluderes! ✅
```

---

## Backend: Opprette Sync Events

### CreateSyncEventsAsync

Kalles når noe skjer som alle må vite om (ny melding, group invite, etc.)
```csharp
// Eksempel: Ny melding sendt
var targetUserIds = conversation.Participants.Select(p => p.UserId).ToList();

await CreateSyncEventsAsync(
    targetUserIds, 
    SyncEventType.NewMessage,
    new {
        conversationId = conversation.Id,
        messageId = message.Id,
        message = message
    });
```

**Hva skjer:**
1. Serialiser eventData til JSON
2. Opprett én SyncEvent per bruker
3. Lagre i bulk til database
4. SignalR pusher events til aktive devices (ikke SyncService sin jobb)

---

## Frontend Flow

### 1. useSync (koordinerer)
```typescript
// Trigger sync ved:
- App åpnes (startup sync)
- App blir visible igjen (recovery sync)
- Nettverk kommer tilbake (recovery sync)
- Manuelt (manual sync)
```

### 2. useDeltaSync (kjerner)
```typescript
performDeltaSync(reason: SyncReason) {
  // POST /api/sync { userDeviceId }
  const response = await syncApi.sync();
  
  if (response.requiresFullRefresh) {
    // Trigger full bootstrap
    await bootstrapService.fullBootstrap();
  } else {
    // Process events
    response.events.forEach(event => processSyncEvent(event));
  }
}
```

### 3. useSignalRMonitor (real-time)
```typescript
signalR.on("ReceiveSyncEvent", (event) => {
  // Umiddelbar oppdatering for aktive devices
  processSyncEvent(event);
});
```

### 4. Duplikat-håndtering
```typescript
function processSyncEvent(event: SyncEvent) {
  // Sjekk om event allerede finnes
  if (store.syncEvents.has(event.id)) {
    console.log("Duplicate event - ignoring");
    return;
  }
  
  // Process new event
  handleNewMessage(event);
}
```

---

## Event Types
```csharp
public enum SyncEventType
{
    NewMessage,              // Ny melding i samtale
    MessageUpdated,          // Melding redigert
    MessageDeleted,          // Melding slettet
    ConversationCreated,     // Ny samtale opprettet
    GroupInviteReceived,     // Invitasjon til gruppe
    GroupInviteAccepted,     // Noen aksepterte gruppe-invite
    ConversationDisbanded,   // Gruppe oppløst
    ParticipantLeft,         // Deltaker forlot gruppe
    // ... flere
}
```

---

## ️ Konfigurasjon
```csharp
private readonly TimeSpan _inactivityThreshold = TimeSpan.FromDays(7);
private readonly int _maxEventThreshold = 30;
private readonly int _eventRetentionDays = 30;
```

**_inactivityThreshold**: Hvor lenge device kan være inaktiv før full refresh kreves
- Standard: 7 dager
- Anbefaling: 3-14 dager

**_maxEventThreshold**: Max antall events før full refresh
- Standard: 30
- Anbefaling: 25-100 (avhenger av event-størrelse)

**_eventRetentionDays**: Hvor lenge sync events beholdes i database
- Standard: 30 dager
- Anbefaling: 3-4x inactivity threshold
- Ratio: 30 / 7 = 4.3x buffer ✅

---

## Database Cleanup

### CleanupOldEventsAsync

Sletter gamle sync events for å frigjøre diskplass.
```csharp
public async Task CleanupOldEventsAsync()
{
    var cutoffDate = DateTime.UtcNow.AddDays(-_eventRetentionDays);
    var deletedCount = await syncEventRepository.DeleteOldEventsAsync(cutoffDate);
    
    logger.LogInformation(
        "Cleaned up {Count} sync events older than {Days} days",
        deletedCount,
        _eventRetentionDays);
}
```

**Kjøres av:** MaintenanceCleanupService (scheduled background job)

**Frekvens:** Daglig (anbefalt)

**Relasjon til inaktivitet:**
```
Timeline:
Day 0:  Event opprettet
Day 7:  Device som ikke har synket får "full refresh"
Day 30: Event slettes fra database
        (Devices hadde 23 dager på seg)
```

---

## Debugging Tips

### Logg-meldinger å se etter:

**Normal delta sync:**
```
Sync request for user user123, device 42, last sync: 2025-01-15 14:00:00
Device 42 has 5 pending events since 2025-01-15 13:50:00
Device 42 synced 5 events successfully (delta sync)
```

**Full refresh pga inaktivitet:**
```
Sync request for user user123, device 42, last sync: 2025-01-08 10:00:00
Device 42 inactive for 7.2 days - requiring full refresh
```

**Full refresh pga for mange events:**
```
Device 42 has 150 pending events since 2025-01-10 08:00:00
Too many events, 150, for device 42 - requiring full refresh
```

**Race condition feil:**
```
CRITICAL: GetSyncEventResponses returned 0 events even though CountEventsSinceTimestamp counted 5 events
```

---

## Best Practices

### Backend
1. ✅ Alltid bruk `LastSyncedEventTime` i WHERE-clause
2. ✅ Oppdater state ETTER events er hentet (ikke før)
3. ✅ Reset `LastSyncedEventTime` til `null` ved full refresh
4. ✅ Behold `LastSyncedEventTime` når ingen nye events
5. ✅ Kjør cleanup daglig via scheduled background job

### Frontend
1. ✅ Håndter duplikater (SignalR + sync gir samme event)
2. ✅ Full refresh = replace entire store
3. ✅ Delta sync = merge events inn i existing store
4. ✅ Fallback til polling hvis SignalR feiler

### Database
1. ✅ Index på `(UserId, CreatedAt)` for SyncEvents
2. ✅ Index på `UserDeviceId` for DeviceSyncState
3. ✅ Cleanup gamle SyncEvents (>30 dager)
4. ✅ Monitor query performance på `CountEventsSinceTimestamp`

---

##  Skalering

**Ved høy trafikk:**
- Øk `_maxEventThreshold` (tillat flere events i delta sync)
- Reduser `_inactivityThreshold` (tvinge full refresh raskere)
- Legg til Redis cache for DeviceSyncState

**Ved store events:**
- Reduser `_maxEventThreshold`
- Komprimer EventData JSON
- Paginer events (f.eks. max 50 per request)

**Ved mange inaktive devices:**
- Reduser `_eventRetentionDays` (mer aggressiv cleanup)
- Cleanup oftere (flere ganger per dag)

---

##  Ferdig!

Systemet gir deg:
- ✅ Real-time oppdateringer via SignalR
- ✅ Reliable backup via sync endpoint
- ✅ Per-device state tracking
- ✅ Race condition protection
- ✅ Automatic full refresh ved behov
- ✅ Automatic database cleanup

**Neste steg:** Test med flere enheter samtidig! 