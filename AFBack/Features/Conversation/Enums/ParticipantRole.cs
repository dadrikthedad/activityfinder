namespace AFBack.Features.Conversation.Enums;

public enum ParticipantRole
{
    PendingSender, // Den som sender en meldingsforespørsel
    PendingRecipient, // Den som mottar en meldingsforespørsel
    Member, // Medlem av en gruppesamtale
    Creator // Oppretteren av en gruppesamtale
}
