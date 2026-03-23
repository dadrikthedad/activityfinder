# SendMessageToUser - Dokumentasjon

## Oversikt

`SendMessageToUserAsync` er et cold-path endepunkt som håndterer meldingssending til en bruker. Endepunktet håndterer både eksisterende samtaler og opprettelse av nye samtaler hvis pending

---

## Flows

### 🔥 Hot Path - Eksisterende Samtale

Brukes når det allerede finnes en samtale mellom brukerne.
```
1. Sjekk om samtale eksisterer
   ↓
2. Sjekk om avsender er pending
   ↓ (hvis pending)
3. Auto-aksepter samtale
   ↓
4. Notify den andre parten (SignalR: ConversationAccepted)
   ↓
5. Send melding via SendMessageAsync
   ↓
6. Return SendMessageToUserResponse (WasAccepted=true)
```

**Eksempel:**
- User A sendte message request til User B
- User B er pending
- User B sender melding → Aksepterer automatisk og sender melding

---

### ❄️ Cold Path - Ny Samtale

Brukes når ingen samtale finnes mellom brukerne.
```
1. Valider at mottaker eksisterer
   ↓
2. Sjekk blokkeringer
   ↓
4. Opprett samtale med type:
   - PendingRequest
   ↓
5. Opprett participants med riktig status
   ↓
6. Opprett og lagre initial melding
   ↓
7. Oppdater CanSend cache (kun DirectChat)
   ↓
8. Send SignalR + MessageNotification + SyncEvents
   ↓
9. Return SendMessageToUserResponse (IsNewConversation=true)
```

---

## Samtale-typer

### PendingRequest

**Participants:**
- Sender: `Status = Accepted`, `Role = PendingSender`, `JoinedAt = now`
- Mottaker: `Status = Pending`, `Role = PendingRecipient`, `InvitedAt = now`

**Events:**
- SignalR: `IncomingPendingRequest` → Mottaker
- MessageNotification: Opprettes for mottaker (type: MessageRequest)
- SyncEvent Sender: `ConversationCreated` → Sender
- SyncEvent Mottaker: `PendingConversationCreated` → Mottaker

**CanSend:** ❌ Oppdateres IKKE (må vente på accept)

**Meldingsgrense:** Sender kan sende maks 5 meldinger før mottaker aksepterer

---

## Auto-Accept Logikk

Når en bruker med pending status sender en melding, aksepteres samtalen automatisk.

### Scenario
```
1. User A sender message request til User B
   → User A: Accepted
   → User B: Pending

2. User B sender melding til User A
   → Auto-aksepter samtalen
   → User B: Pending → Accepted
   → Send "ConversationAccepted" event til User A
   → Send melding
```

### Implementering
```csharp
var isSenderPending = existingConversation.Type == ConversationType.PendingRequest 
    && existingConversation.Participants
        .Any(cp => cp.UserId == userId && cp.Status == ConversationStatus.Pending);

if (isSenderPending)
{
    await conversationService.AcceptConversationAsync(userId, conversationId);
    wasAccepted = true;
}
```

---

## SignalR Events

### IncomingPendingRequest

**Sendt til:** Mottaker  
**Når:** Ny PendingRequest samtale opprettes  
**Payload:** `SendMessageToUserResponse`
```typescript
connection.on("IncomingPendingRequest", (data) => {
  addToPendingList(data.Conversation);
  showNotification(`${sender.FullName} wants to message you`);
});
```

---

### IncomingDirectConversation

**Sendt til:** Mottaker  
**Når:** Ny DirectChat samtale opprettes  
**Payload:** `SendMessageToUserResponse`
```typescript
connection.on("IncomingDirectConversation", (data) => {
  addToActiveList(data.Conversation);
  showNotification(`New message from ${sender.FullName}`);
});
```

---

### ConversationAccepted

**Sendt til:** Den andre parten  
**Når:** Pending conversation aksepteres (via auto-accept)  
**Payload:** `{ ConversationId, AcceptedBy, AcceptedAt }`
```typescript
connection.on("ConversationAccepted", (data) => {
  moveFromPendingToActive(data.ConversationId);
  showNotification("Your message request was accepted");
});
```

---

## SyncEvents

| Event Type | Sender | Mottaker | Når |
|------------|--------|----------|-----|
| `ConversationCreated` | ✅ | ✅ (DirectChat) | Ny DirectChat opprettet |
| `ConversationCreated` | ✅ | ❌ | Ny PendingRequest opprettet |
| `PendingConversationCreated` | ❌ | ✅ | Ny PendingRequest opprettet |

---

## MessageNotification

Opprettes alltid for mottaker, uavhengig av samtale-type.

### DirectChat
- **Type:** `NewMessage`
- **Preview:** `"{SenderName}: [message preview]"` eller `"{SenderName} has sent you {count} messages"`

### PendingRequest
- **Type:** `MessageRequest`
- **Preview:** `"{SenderName} wants to message you"`

---

## Response Structure
```csharp
public class SendMessageToUserResponse
{
    public int ConversationId { get; set; }
    public bool IsNewConversation { get; set; }  // true hvis ny samtale ble opprettet
    public bool WasAccepted { get; set; }        // true hvis pending ble akseptert
    public ConversationResponse Conversation { get; set; }
    public MessageResponse Message { get; set; }
}
```

### Frontend Håndtering
```typescript
if (response.IsNewConversation) {
  // Ny samtale opprettet
  if (response.Conversation.Type === 'PendingRequest') {
    addToSentRequests(response.Conversation);
  } else {
    addToActiveConversations(response.Conversation);
  }
} else if (response.WasAccepted) {
  // Pending ble akseptert
  removeFromPendingConversations(response.ConversationId);
  addToActiveConversations(response.Conversation);
} else {
  // Vanlig melding i eksisterende samtale
  updateConversation(response.Conversation);
}
```

---

## Feilhåndtering

| Error | Status | Årsak |
|-------|--------|-------|
| `User not found` | 404 NotFound | Mottaker eksisterer ikke |
| `You cannot send messages to a user you have blocked` | 403 Forbidden | Sender har blokkert mottaker |
| `You cannot send messages to this user` | 403 Forbidden | Sender er blokkert av mottaker |
| `Failed to retrieve sent message` | 500 InternalServerError | Database feil etter sending |

**Merk:** Ytterligere validering (archived, message limits, etc.) skjer i `SendMessageAsync`.

---

## Sekvensdiagram

### Ny PendingRequest
```
User A                  Backend                 User B
  |                        |                       |
  |--SendMessageToUser---->|                       |
  |                        |                       |
  |                        |---Create Conversation-|
  |                        |   (A: Accepted)       |
  |                        |   (B: Pending)        |
  |                        |                       |
  |                        |---SignalR------------>|
  |                        |   (IncomingPending)   |
  |                        |                       |
  |                        |---Notification------->|
  |<--Response-------------|   (MessageRequest)    |
  |   (IsNewConversation)  |                       |
```

### Auto-Accept ved å sende melding
```
User B                  Backend                 User A
  |                        |                       |
  |--SendMessageToUser---->|                       |
  |                        |---Check status------->|
  |                        |<--B is Pending--------|
  |                        |                       |
  |                        |---AcceptConversation--|
  |                        |   (B: Pending→Accepted)|
  |                        |                       |
  |                        |---SignalR------------>|
  |                        |   (ConversationAccepted)|
  |                        |                       |
  |                        |---SendMessage-------->|
  |                        |                       |
  |<--Response-------------|                       |
  |   (WasAccepted=true)   |                       |
```

---

## Viktige Detaljer

### CanSend Cache
- ✅ Oppdateres kun for DirectChat
- ❌ Oppdateres IKKE for PendingRequest
- Årsak: Mottaker må godta før full sending er tillatt

### Meldingsgrenser
- PendingRequest: Sender kan sende maks 5 meldinger
- DirectChat: Ingen grense
- Validering skjer i `SendMessageAsync`

### Attachments
- ❌ Ikke støttet i `SendMessageToUserAsync`
- Årsak: Cold path er kun for tekstmeldinger
- For å sende vedlegg, bruk `SendMessageAsync` i eksisterende samtale

### Transaksjonssikkerhet
- Conversation, Participants og Message opprettes i én transaksjon
- Hvis melding feiler, rulles alt tilbake
- SignalR og SyncEvents sendes ETTER transaksjonen er committed

---

## Testing

### Test Cases

**Hot Path:**
1. ✅ Send melding i eksisterende DirectChat
2. ✅ Send melding i eksisterende PendingRequest (ikke pending selv)
3. ✅ Send melding som pending mottaker (auto-accept)

**Cold Path:**
6. ✅ Blokkering forhindrer opprettelse
7. ✅ Mottaker eksisterer ikke

**Edge Cases:**
8. ✅ Refresh conversation data etter accept
9. ✅ CanSend cache oppdateres kun for DirectChat
10. ✅ MessageNotification opprettes korrekt for begge typer

---

## Relaterte Endepunkter

- `POST /api/messages` - Send melding i eksisterende samtale (hot path)
- `POST /api/conversations/{id}/accept` - Aksepter pending conversation
- `POST /api/conversations/{id}/reject` - Avslå pending conversation
- `DELETE /api/conversations/{id}` - Arkiver samtale

---

## Versjon

**Sist oppdatert:** 2025-01-24  
**Versjon:** 1.0