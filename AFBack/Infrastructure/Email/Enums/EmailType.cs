namespace AFBack.Infrastructure.Email.Enums;

/// <summary>
/// Type email som sendes — brukes for separat rate limiting per type.
/// IP-grensen er delt på tvers, men cooldown og daglig grense er per type.
/// </summary>
public enum EmailType
{
    Verification,
    PasswordReset,
    EmailChange,
    PhoneChange
}
