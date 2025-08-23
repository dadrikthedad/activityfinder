/// <summary>
/// Predefinerte aktivitetstyper for konsistens
/// </summary>
public static class SuspiciousActivityTypes
{
    public const string FAILED_LOGIN = "FAILED_LOGIN";
    public const string UNVERIFIED_LOGIN_ATTEMPT = "UNVERIFIED_LOGIN_ATTEMPT";
    public const string REGISTRATION_VALIDATION_FAILED = "REGISTRATION_VALIDATION_FAILED";
    public const string DUPLICATE_EMAIL_REGISTRATION = "DUPLICATE_EMAIL_REGISTRATION";
    public const string VERIFICATION_EMAIL_FAILED = "VERIFICATION_EMAIL_FAILED";
    public const string VERIFICATION_EMAIL_ERROR = "VERIFICATION_EMAIL_ERROR";
    public const string INVALID_TOKEN_ACCESS = "INVALID_TOKEN_ACCESS";
    public const string EXCESSIVE_PASSWORD_RESET = "EXCESSIVE_PASSWORD_RESET";
    public const string BRUTE_FORCE_ATTEMPT = "BRUTE_FORCE_ATTEMPT";
    public const string SUSPICIOUS_USER_AGENT = "SUSPICIOUS_USER_AGENT";
    public const string API_ABUSE = "API_ABUSE";
    public const string EXCESSIVE_EMAIL_VERIFICATION = "EXCESSIVE_EMAIL_VERIFICATION";
}