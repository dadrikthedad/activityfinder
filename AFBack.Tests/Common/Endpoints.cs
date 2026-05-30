namespace AFBack.Tests.Common;

/// <summary>
/// Alle API-endepunkter som konstanter — unngaar magiske strenger i integrasjonstester.
/// Parameteriserte ruter er statiske metoder som returnerer den ferdige URL-en.
/// </summary>
public static class Endpoints
{
    public static class Auth
    {
        private const string Base = "/api/auth";

        public const string Signup              = $"{Base}/signup";
        public const string Login               = $"{Base}/login";
        public const string LoginVerifyMfa      = $"{Base}/login/verify-mfa";
        public const string Logout              = $"{Base}/logout";
        public const string LogoutAll           = $"{Base}/logout-all";
        public const string ReportUnauthorized  = $"{Base}/report-unauthorized-change";
    }

    public static class Token
    {
        private const string Base = "/api/token";

        public const string Refresh = $"{Base}/refresh";
    }

    public static class Verification
    {
        private const string Base = "/api/verification";

        public const string ResendEmail         = $"{Base}/resend-verification";
        public const string VerifyEmail         = $"{Base}/verify-email";
        public const string ResendPhone         = $"{Base}/resend-phone-verification";
        public const string VerifyPhone         = $"{Base}/verify-phone";
    }

    public static class PasswordReset
    {
        private const string Base = "/api/password-reset";

        public const string ChangePassword          = $"{Base}/change-password";
        public const string ForgotPassword          = $"{Base}/forgot-password";
        public const string VerifyResetEmail        = $"{Base}/verify-password-reset-email";
        public const string SendResetSms            = $"{Base}/send-password-reset-sms";
        public const string VerifyResetSms          = $"{Base}/verify-password-reset-sms";
        public const string ResetPassword           = $"{Base}/reset-password";
    }

    public static class Conversation
    {
        private const string Base = "/api/conversation";

        public const string Active      = $"{Base}/active";
        public const string Pending     = $"{Base}/pending";
        public const string Archived    = $"{Base}/archived";
        public const string Rejected    = $"{Base}/rejected";
        public const string Search      = $"{Base}/search";
        public const string SendToUser  = $"{Base}/send-to-user";

        public static string ById(int id)       => $"{Base}/{id}";
        public static string Restore(int id)    => $"{Base}/{id}/restore";
        public static string Accept(int id)     => $"{Base}/{id}/accept";
        public static string Reject(int id)     => $"{Base}/{id}/reject";
        public static string Delete(int id)     => $"{Base}/{id}";
    }

    public static class GroupConversation
    {
        private const string Base = "/api/groupconversation";

        public const string Create  = $"{Base}/create";
        public const string Left    = $"{Base}/left";

        public static string Accept(int id)             => $"{Base}/{id}/accept";
        public static string Reject(int id)             => $"{Base}/{id}/reject";
        public static string Invite(int id)             => $"{Base}/{id}/invite";
        public static string Leave(int id)              => $"{Base}/{id}/leave";
        public static string DeleteLeft(int id)         => $"{Base}/left/{id}";
        public static string UpdateName(int id)         => $"{Base}/{id}/groupname";
        public static string UpdateImage(int id)        => $"{Base}/{id}/groupimage";
        public static string DeleteImage(int id)        => $"{Base}/{id}/groupimage";
        public static string UpdateDescription(int id)  => $"{Base}/{id}/groupdescription";
    }

    public static class Message
    {
        private const string Base = "/api/message";

        public const string Send    = Base;
        public const string Batch   = $"{Base}/batch";

        public static string ByConversation(int conversationId) => $"{Base}/{conversationId}";
        public static string Delete(int messageId)              => $"{Base}/{messageId}";
    }

    public static class Encryption
    {
        private const string Base = "/api/encryption";

        public const string UploadPublicKey         = $"{Base}/public-key";
        public const string GetMyPublicKey          = $"{Base}/public-key";
        public const string GetUsersPublicKeys      = $"{Base}/users/public-keys";
        public const string StoreRecoverySeed       = $"{Base}/recovery-seed";

        public static string GetConversationKeys(int conversationId) => $"{Base}/conversation/{conversationId}/keys";
    }

    public static class Account
    {
        private const string Base = "/api/account";

        public const string RequestEmailChange              = $"{Base}/request-email-change";
        public const string VerifyCurrentEmailChange        = $"{Base}/verify-current-email-change";
        public const string VerifyEmailChange               = $"{Base}/verify-email-change";
        public const string RequestPhoneChange              = $"{Base}/request-phone-change";
        public const string VerifyCurrentEmailPhoneChange   = $"{Base}/verify-current-email-phone-change";
        public const string VerifyPhoneChange               = $"{Base}/verify-phone-change";
        public const string UpdateName                      = $"{Base}/name";
        public const string UpdateProfileImage              = $"{Base}/profileimage";
        public const string DeleteProfileImage              = $"{Base}/profileimage";
    }

    public static class Settings
    {
        private const string Base = "/api/settings";

        public const string Get     = Base;
        public const string Update  = Base;
    }

    public static class Profile
    {
        private const string Base = "/api/profile";

        public const string GetMine  = Base;
        public const string Update   = Base;

        public static string GetById(string userId) => $"{Base}/{userId}";
    }

    public static class Blocking
    {
        private const string Base = "/api/blocking";

        public const string GetAll  = Base;

        public static string Block(string userId)   => $"{Base}/{userId}";
        public static string Unblock(string userId) => $"{Base}/unblock/{userId}";
    }

    public static class Reaction
    {
        private const string Base = "/api/reaction";

        public const string Add = $"{Base}/add-reaction";
    }

    public static class MessageNotifications
    {
        private const string Base = "/api/messagenotifications";

        public const string GetAll          = Base;
        public const string UnreadCount     = $"{Base}/unread-count";
        public const string ReadAll         = $"{Base}/read-all";
        public const string DeleteAll       = Base;

        public static string GetById(int id)                    => $"{Base}/{id}";
        public static string GetByConversation(int id)          => $"{Base}/conversation/{id}";
        public static string MarkRead(int id)                   => $"{Base}/{id}";
        public static string MarkConversationRead(int id)       => $"{Base}/conversation/{id}/read";
        public static string Delete(int id)                     => $"{Base}/{id}";
    }

    public static class Search
    {
        private const string Base = "/api/searching";

        public const string Users       = $"{Base}/users";
        public const string UsersQuick  = $"{Base}/users/quick";
        public const string UsersInvite = $"{Base}/users/invite";
    }

    public static class Support
    {
        private const string Base = "/api/support";

        public const string Submit = Base;
        public const string Report = $"{Base}/report";
    }

    public static class SyncEvents
    {
        private const string Base = "/api/syncevent";

        public const string Sync = $"{Base}/sync";
    }

    public static class Geography
    {
        private const string Base = "/api/geography";

        public const string Countries   = $"{Base}/countries";
        public const string Geolocation = $"{Base}/geolocation";

        public static string Regions(string countryCode) => $"{Base}/regions/{countryCode}";
    }

    public static class Bootstrap
    {
        private const string Base = "/api/bootstrap";

        public const string Critical = $"{Base}/critical";
    }
}
