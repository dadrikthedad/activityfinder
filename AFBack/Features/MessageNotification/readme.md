# MessageNotification

## Oversikt

MessageNotification-systemet håndterer varsler til brukere om hendelser i samtaler. Det støtter både 1-1 samtaler og gruppesamtaler, med ulik logikk for hver type.

**Viktig prinsipp:** Systemmeldinger (som vises i samtalen) og notification-summary (som vises i varselvinduet) bygges i service-laget og sendes inn til NotificationService. Dette sikrer konsistens og single source of truth.

---

## Modeller

### MessageNotification

Hovedmodellen for alle typer varsler.

| Egenskap | Type | Beskrivelse |
|----------|------|-------------|
| `Id` | int | Primærnøkkel |
| `RecipientId` | string | Brukeren som mottar varselet |
| `SenderId` | string? | Brukeren som trigget varselet (null for systemmeldinger) |
| `MessageId` | int? | Referanse til melding (kun for NewMessage-type) |
| `ConversationId` | int | Samtalen varselet gjelder |
| `Type` | MessageNotificationType | Type varsel (se enum nedenfor) |
| `Summary` | string | Teksten som vises i varselvinduet (maks 500 tegn) |
| `CreatedAt` | DateTime | Når varselet ble opprettet |
| `IsRead` | bool | Om varselet er lest |
| `ReadAt` | DateTime? | Når varselet ble lest |
| `MessageCount` | int | Antall meldinger (for stacking av NewMessage) |
| `EventCount` | int? | Antall GroupEvents (for GroupEvent-type) |
| `LastUpdatedAt` | DateTime? | Sist oppdatert (ved stacking) |

### MessageNotificationType (Enum)

| Verdi | Beskrivelse |
|-------|-------------|
| `NewMessage` | Ny melding mottatt |
| `PendingMessageRequestReceived` | Mottatt samtaleforespørsel |
| `PendingConversationRequestApproved` | Samtaleforespørsel akseptert |
| `MessageReaction` | Reaksjon på melding |
| `GroupRequest` | Invitert til gruppe |
| `GroupRequestApproved` | Gruppeinvitasjon akseptert |
| `GroupRequestInvited` | Nye brukere invitert til gruppe |
| `GroupEvent` | Samlet varsel for gruppehendelser |
| `GroupDisbanded` | Gruppe oppløst |

### GroupEvent

Individuell hendelse i en gruppesamtale. Flere GroupEvents kan kobles til én MessageNotification.

| Egenskap | Type | Beskrivelse |
|----------|------|-------------|
| `Id` | int | Primærnøkkel |
| `ConversationId` | int | Gruppen hendelsen skjedde i |
| `TriggeredByUserId` | string | Brukeren som utførte handlingen |
| `EventType` | GroupEventType | Type hendelse (se enum nedenfor) |
| `Summary` | string | Beskrivelse av hendelsen (maks 3000 tegn) |
| `CreatedAt` | DateTime | Når hendelsen skjedde |

### GroupEventType (Enum)

| Verdi | Beskrivelse |
|-------|-------------|
| `MemberInvited` | Bruker(e) invitert til gruppen |
| `MemberAccepted` | Bruker aksepterte invitasjon |
| `MemberDeclined` | Bruker avslo invitasjon |
| `MemberLeft` | Bruker forlot gruppen |
| `MemberRemoved` | Bruker ble fjernet fra gruppen |
| `GroupCreated` | Gruppen ble opprettet |
| `GroupNameChanged` | Gruppenavn ble endret |
| `GroupImageChanged` | Gruppebilde ble endret |

### MessageNotificationGroupEvent

Join-tabell som kobler MessageNotification til GroupEvent (many-to-many).

| Egenskap | Type | Beskrivelse |
|----------|------|-------------|
| `MessageNotificationId` | int | FK til MessageNotification |
| `GroupEventId` | int | FK til GroupEvent |

**Compound Primary Key:** (MessageNotificationId, GroupEventId)

---

## Flyt: 1-1 Samtaler

### Ny melding (NewMessage)

```
SendMessageAsync (MessageBroadcastService)
    │
    ├─► CreateNewMessageNotificationAsync (MessageNotificationService)
    │       │
    │       ├─► Sjekk om ulest notification eksisterer for denne samtalen
    │       │
    │       ├─► HVIS eksisterer:
    │       │       • MessageCount++
    │       │       • Oppdater Summary: "has sent you {count} messages"
    │       │       • Oppdater LastUpdatedAt
    │       │
    │       └─► HVIS ny:
    │               • Bygg Summary fra meldingstekst: "said: {preview}"
    │               • Opprett MessageNotification med Summary
    │
    └─► Return MessageNotificationResponse (inkludert i SignalR og SyncEvent)
```

**Summary-eksempler:**
- Første melding: `"said: Hei, hvordan går det?"`
- Flere meldinger: `"has sent you 3 messages"`
- Med vedlegg: `"sent 2 attachments"`

### Samtaleforespørsel mottatt (PendingMessageRequestReceived)

```
BroadcastNewPendingRequestAsync (ConversationBroadcastService)
    │
    └─► CreatePendingConversationNotificationAsync (MessageNotificationService)
            │
            ├─► Bygg Summary: "{senderName} wants to message you"
            │
            └─► Opprett MessageNotification med Summary
```

### Samtaleforespørsel akseptert (PendingConversationRequestApproved)

```
AcceptPendingConversationRequestAsync (DirectConversationService)
    │
    ├─► Bygg summary (brukes til både systemmelding og notification)
    │       • Systemmelding: "{name} has accepted the conversation request"
    │       • Notification: "{name} has accepted your conversation request"
    │
    ├─► SendSystemMessageAsync (vises i samtalen)
    │
    └─► BroadcastPendingRequestAcceptedAsync
            │
            └─► CreateConversationAcceptedNotificationAsync
                    │
                    └─► Opprett MessageNotification med Summary fra parameter
```

---

## Flyt: Gruppesamtaler (GroupEvent)

### Oversikt

Gruppehendelser samles i én MessageNotification per bruker per gruppe (så lenge den er ulest). Hver individuell hendelse lagres som en GroupEvent og kobles til notifikasjonen via MessageNotificationGroupEvent.

```
┌─────────────────────────────────────────────────────┐
│ MessageNotification                                 │
│ Summary: "5 new activities in 'Project Team'"       │
│ EventCount: 5                                       │
├─────────────────────────────────────────────────────┤
│ GroupEvents (via join-tabell):                      │
│ • "Gregory joined the group"                        │
│ • "Per joined the group"                            │
│ • "Magnus invited Ola to the group"                 │
│ • "Lisa changed the group name to 'Dev Team'"       │
│ • "Kari left the group"                             │
└─────────────────────────────────────────────────────┘
```

### Generell flyt for gruppehendelser

```
Service-metode (f.eks. AcceptPendingGroupConversationRequestAsync)
    │
    ├─► Bygg summary (samme tekst som systemmelding)
    │       Eksempel: "{userName} joined the group"
    │
    ├─► SendSystemMessageAsync (vises i samtalen)
    │
    └─► BroadcastService.BroadcastGroupXxxAsync
            │
            └─► GroupNotificationService.CreateGroupNotificationEventAsync
                    │
                    ├─► For hver mottaker:
                    │       │
                    │       ├─► Finn eksisterende ulest GroupEvent-notification
                    │       │
                    │       ├─► HVIS ny notification:
                    │       │       • Opprett MessageNotification
                    │       │       • Summary = event summary
                    │       │       • EventCount = 1
                    │       │
                    │       ├─► HVIS eksisterende:
                    │       │       • EventCount++
                    │       │       • Summary = "{count} new activities in '{groupName}'"
                    │       │
                    │       ├─► Opprett GroupEvent med summary
                    │       │
                    │       ├─► Link via MessageNotificationGroupEvent
                    │       │
                    │       └─► Hent alle GroupEvents (maks 30) for response
                    │
                    └─► Return Dictionary<userId, MessageNotificationResponse>
```

### Hendelsestyper og summary-format

| Hendelse | Summary-format |
|----------|----------------|
| Bruker joiner | `"{name} joined the group"` |
| Bruker avslår | `"{name} declined the invitation"` |
| Bruker forlater | `"{name} left the group"` |
| Bruker inviteres | `"{inviter} invited {names} to the group"` |
| Navn endres | `"{name} changed the group name to '{newName}'"` |
| Bilde endres | `"{name} changed the group image"` |
| Ny leder | `"{name} left the group. {newLeader} is now the group leader"` |

### Frontend-visning

Frontend mottar alle GroupEvents og kan gruppere konsekutive like hendelser for penere visning:

```
Backend sender:
[
  { type: "MemberAccepted", summary: "Magnus joined" },
  { type: "MemberAccepted", summary: "Per joined" },
  { type: "MemberAccepted", summary: "Kari joined" },
  { type: "GroupNameChanged", summary: "Lisa changed name" }
]

Frontend viser:
• Magnus, Per, Kari joined the group
• Lisa changed the group name
```

---

## Services

### MessageNotificationService

Håndterer 1-1 notifications:
- `CreateNewMessageNotificationAsync` - Ny melding
- `CreatePendingConversationNotificationAsync` - Samtaleforespørsel mottatt
- `CreateConversationAcceptedNotificationAsync` - Forespørsel akseptert

### GroupNotificationService

Håndterer gruppe-notifications:
- `CreateGroupNotificationEventAsync` - Oppretter/oppdaterer GroupEvent-notification

---

## Response DTOs

### MessageNotificationResponse

Brukes for alle notification-typer. Sendes via SignalR og SyncEvent.

### GroupEventResponse

Representerer én GroupEvent i responsen:
```csharp
public class GroupEventResponse
{
    public int Id { get; set; }
    public GroupEventType Type { get; set; }
    public string Summary { get; set; }
    public DateTime CreatedAt { get; set; }
}
```

---

## Stacking-logikk

### NewMessage (1-1)
- Stacker basert på samme avsender + samtale
- `MessageCount` økes for hver ny melding
- Summary endres til aggregert tekst ved flere meldinger

### GroupEvent (gruppe)
- Stacker alle hendelser i samme gruppe til én notification (så lenge ulest)
- `EventCount` økes for hver ny hendelse
- Summary endres til "{count} new activities..." ved flere hendelser
- Individuelle GroupEvents bevares for frontend-visning
- Frontend grupperer konsekutive like hendelser ved rendering
