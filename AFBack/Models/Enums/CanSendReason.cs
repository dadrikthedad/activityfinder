namespace AFBack.Models.Enums;

public enum CanSendReason
{
    MessageRequest = 0,  // Godkjent via meldingsforespørsel
    GroupRequest = 1,    // Godkjent via gruppeforespørsel 
    GroupRequestCreator = 2,
    Friendship = 3       // Automatisk godkjent pga vennskap
}
