Conversation flyt:

# 1-1 samtaler (Kun 1 samtale pr 2 brukere):

Bruker A spør bruker B om å starte en samtale.
Bruker A oppretter en Conversation med ConversationType PendingRequest
Bruker A og bruker B opprettes i en ConversationParticipant knyttet opp til Conversation
Bruker A får ParticipantRole Sender og ConversationStatus Accepted
Bruker B får ParticipantRole Recipient og ConversationStatus Pending
Bruker A kan sende maks 5 meldinger til bruker B


##  Scenario 1: 
Bruker B rejekter samtale og samtale forsvinner. Bruker A kan ikke sende flere meldinger 
og får ikke beskjed, bare at samtalen ikke er tilgjengelig lenger. 
Bruker B kan hente samtalen fra declined conversations. Bruker A kan slette samtalen 
(arkivere/soft delete) for å så hente opp igjen fra deleted/archived conversations. Hvis bruker B aksepterer
senere så får bruker A notifikasjon og beskjed, selvom den er tidligere slettet


##  Scenario 2:
Bruker B gjør ingenting. Samtalen blir i pending, Bruker A kan slette samtalen
(arkivere/soft delete) for å så hente opp igjen fra deleted/archived conversations. Godtar bruker B senere vil
bruker A få en beskjed om det, samt at samtalen dukker opp i samtalelisten

## Scenario 3: 
1. Bruker B godkjenner samtalen. 
2. Conversation blir DirectChat istedenfor PendingRequest
2. Bruker B får ConversationStatus Accepted
4. Bruker A får notification og melding i samtalen.


# Gruppesamtaler:
Bruker A inviterer bruker B og bruker C.
Bruker A oppretter en Conversation med ConversationType GroupChat og bruker A får rollen Creator
Bruker A, B og C opprettes i en ConversationParticipant knyttet opp til Conversation
Bruker A får ConversationStatus Accepted
Bruker B og C får ConversationStatus Pending og rollen Member
Bruker A kan sende evig med meldinger og invitere flere brukere. 
B og C får ingen notifikasjoner, lov til å se meldinger eller systemmeldinger før de godkjenner

## Scenario 1:
Bruker A forlater samtalen uten at noen andre har godkjent. Samtalen slettes og forsvinner fra alle sine lister

## Scenario 2:
Bruker B godkjenner samtalen
Bruker B får ConversationStatus Accepted og rolle Member
Bruker A får notifikasjon på ny bruker har godkjent

### Scenario 2A:
Bruker A forlater samtalen
Bruker A får ny ConversationLeftRecord og ConversationParticipant slettes
Bruker A kan aldri komme inn i samtalen igjen, før de selv sletter sin ConversationLeftRecord og blir invitert
Bruker B blir nå Creator


Sending av melding:
Før SignalR, MessageNotification og SyncEvent så filterer vi bort brukere som har avslått og slettet/arkivert
når vi henter fra databasen.

Vi filtrerer vekk oss selv før Signalr.
SignalR sendes til alle Accepted brukere hvis det er DirectChat eller GroupChat.
Er det Pending-chat så får mottaker en silent melding (ingen visuell feedback for bruker, men hvis de sjekker
samtalen så er meldingen der. Redusere spam)

Vi filtrerer vekk oss selv før MessageNotification.
MessageNotification lagres til alle godkjente brukerne utenom avsender. 

SyncEvent lagres til:
- DirectChat: Begge brukerne (inkl. sender for andre enheter)
- PendingRequest: Begge brukerne (inkl. sender for andre enheter)
- GroupChat: Kun Accepted/Creator (IKKE Pending)


Systemmelding:
 
1. CreateSystemMessageAsync lager en melding til en samtale
2. 