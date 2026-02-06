# SignalR Feature

Sanntidskommunikasjon for ActivityFinder. Håndterer WebSocket-tilkoblinger, meldingsutsending, og conversation presence tracking.

## Struktur

```
Features/SignalR/
├── Constants/
│   └── HubConstants.cs           # Event-navn, gruppe-prefixes, query params
├── DTOs/
│   ├── ConnectionMetadata.cs     # Intern DTO - connection info fra klient
│   ├── ConnectionResult.cs       # Intern DTO - resultat fra registration
│   └── Responses/
│       ├── ConnectionErrorResponse.cs
│       ├── ConnectionInfoResponse.cs
│       ├── DeviceCollisionResponse.cs
│       └── LoggedInElsewhereResponse.cs
├── Hubs/
│   └── UserHub.cs                # SignalR hub - WebSocket endpoint
├── Interfaces/
│   ├── IConversationPresenceService.cs
│   ├── IHubConnectionService.cs
│   ├── ISignalRNotificationService.cs
│   └── IUserHubClient.cs         # Strongly-typed client events
├── Providers/
│   └── CustomUserIdProvider.cs   # Mapper JWT claim til SignalR user ID
└── Services/
    ├── ConnectionMetadataExtractor.cs
    ├── ConversationPresenceService.cs
    ├── HubConnectionService.cs
    └── SignalRNotificationService.cs
```

## Flyt

### 1. Bruker kobler til

```
Klient → WebSocket connect → UserHub.OnConnectedAsync()
                                    ↓
                            ConnectionMetadataExtractor.ExtractMetadata()
                                    ↓
                            HubConnectionService.RegisterConnectionAsync()
                                    ↓
                            Lagrer i database + sjekker device collision
                                    ↓
                            Legger til i user-gruppe: "user_{userId}"
```

### 2. Bruker åpner samtale

```
Klient → hub.invoke("JoinConversation", conversationId)
                    ↓
            UserHub.JoinConversation()
                    ↓
            ConversationPresenceService.JoinConversationAsync()
                    ↓
            Redis SADD: conversation:{id}:active_users + user:{id}:active_conversations
                    ↓
            SignalR Groups.AddToGroupAsync("conversation_{id}")
```

### 3. Ny melding sendes

```
MessageBroadcastService.ProcessMessageBroadcast()
            ↓
    SignalRNotificationService.SendToUserAsync()
            ↓
    hubContext.Clients.User(userId).SendAsync(eventName, payload)
            ↓
    Klient mottar event
```

### 4. Bruker disconnecter

```
UserHub.OnDisconnectedAsync()
            ↓
    ConversationPresenceService.LeaveAllConversationsAsync()
            ↓
    Redis: Fjern fra alle conversation sets + slett user set
            ↓
    HubConnectionService.UnregisterConnectionAsync()
```

## Services

### ISignalRNotificationService
Sender SignalR-meldinger med innebygd feilhåndtering.

| Metode | Beskrivelse |
|--------|-------------|
| `SendToUserAsync` | Send til én bruker (alle enheter) |
| `SendToUsersAsync` | Send til flere brukere |
| `SendToGroupAsync` | Send til en SignalR-gruppe |

### IConversationPresenceService
Tracker hvilke brukere som er aktive i hvilke samtaler via Redis.

| Metode | Beskrivelse |
|--------|-------------|
| `JoinConversationAsync` | Bruker åpner samtale |
| `LeaveConversationAsync` | Bruker lukker samtale |
| `LeaveAllConversationsAsync` | Bruker disconnecter |
| `IsUserInConversationAsync` | Sjekk om bruker er aktiv i samtale |
| `GetActiveUsersInConversationAsync` | Hent alle aktive brukere i samtale |
| `GetUserActiveConversationsAsync` | Hent alle samtaler bruker er aktiv i |

### IHubConnectionService
Håndterer connection lifecycle i database.

| Metode | Beskrivelse |
|--------|-------------|
| `RegisterConnectionAsync` | Registrer ny WebSocket-tilkobling |
| `UnregisterConnectionAsync` | Fjern tilkobling ved disconnect |
| `GetActiveConnectionsForUserAsync` | Hent alle connections for én bruker |
| `GetActiveConnectionsForUsersAsync` | Hent connections for flere brukere |

## Hub Metoder

### Klient → Server

| Metode | Beskrivelse |
|--------|-------------|
| `Ping()` | Health check, returnerer "pong" |
| `GetConnectionInfo()` | Returnerer connection metadata |
| `JoinConversation(conversationId)` | Åpne/gå inn i samtale |
| `LeaveConversation(conversationId)` | Lukke/forlate samtale |

### Server → Klient (HubConstants.ClientEvents)

| Event | Beskrivelse |
|-------|-------------|
| `ReceiveMessage` | Ny melding |
| `MessageDeleted` | Melding slettet |
| `ConversationAccepted` | Samtaleforespørsel akseptert |
| `IncomingPendingRequest` | Ny samtaleforespørsel |
| `IncomingDirectConversation` | Ny direktesamtale |
| `GroupMemberJoined` | Medlem aksepterte gruppeinvitasjon |
| `GroupMemberLeft` | Medlem forlot gruppe |
| `GroupInfoUpdated` | Gruppeinfo oppdatert |
| `DeviceCollision` | Samme enhet koblet til fra ny lokasjon |
| `ConnectionError` | Feil ved tilkobling |

## Redis Keys

```
conversation:{conversationId}:active_users    → Set<userId>
user:{userId}:active_conversations            → Set<conversationId>
```

## Registrering

```csharp
// Program.cs
builder.Services.AddSignalRServices();

// Map hub endpoint
app.MapHub<UserHub>("/hub");
```

## Bruk i andre services

```csharp
public class MyService(ISignalRNotificationService signalR, IConversationPresenceService presence)
{
    public async Task NotifyUser(string userId)
    {
        await signalR.SendToUserAsync(
            userId,
            HubConstants.ClientEvents.ReceiveMessage,
            payload,
            "context for logging");
    }

    public async Task<bool> IsUserActive(string userId, int conversationId)
    {
        return await presence.IsUserInConversationAsync(userId, conversationId);
    }
}
```
