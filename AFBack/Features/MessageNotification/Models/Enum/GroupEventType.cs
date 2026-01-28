namespace AFBack.Features.MessageNotification.Models.Enum;

public enum GroupEventType
{
    MemberInvited = 1,      // Brukere invitert til gruppen
    MemberAccepted = 2,     // Bruker godkjente invitasjon
    MemberLeft = 3,         // Bruker forlot gruppen
    MemberRemoved = 4,      // Bruker ble fjernet fra gruppen
    MemberDeclined = 6,     // Bruker har forlatt gruppen
    GroupCreated = 7,       // Gruppe opprettet
    GroupNameChanged = 8,   // Gruppenavn endret
    GroupImageChanged = 9   // Gruppebilde endret
}

