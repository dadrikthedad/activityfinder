namespace AFBack.Features.Conversation.Enums;

public enum ConversationType
{
    DirectChat, // 1-1 samtale (godkjent av begge)
    GroupChat, // Gruppe
    PendingRequest // 1-1 forespørsel (Se Role for å skille mellom avsender og mottaker)
}
