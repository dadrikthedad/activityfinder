namespace AFBack.Tests.Common;

/// <summary>
/// Delte standardverdier for testentiteter — speiler standardverdiene i de fire builderne.
/// Bruk disse når en test ikke bryr seg om den spesifikke verdien, og overrid kun når
/// verdien er relevant for scenariet som testes.
/// </summary>
public static class TestConstants
{
    /// <summary>
    /// Standardverdier for AppUser / UserBuilder.
    /// </summary>
    public static class Users
    {
        public const string DefaultPassword  = "TestPass123!";
        public const string DefaultFirstName = "Test";
        public const string DefaultLastName  = "Bruker";
        public const string DefaultPhone     = "+4700000001";
    }

    /// <summary>
    /// Standardverdier for UserDevice / UserDeviceBuilder.
    /// </summary>
    public static class Devices
    {
        public const string DefaultDeviceName = "Test Device";
        public const string DefaultIpAddress  = "127.0.0.1";
    }

    /// <summary>
    /// Standardverdier for UserProfile / UserProfileBuilder.
    /// </summary>
    public static class Profiles
    {
        public const string DefaultCountryCode = "NO";

        // DateOnly kan ikke vaere const — bruk static readonly
        public static readonly DateOnly DefaultDateOfBirth = new(1995, 6, 15);
    }

    /// <summary>
    /// Standardverdier for UserSettings / UserSettingsBuilder.
    /// </summary>
    public static class Settings
    {
        public const string DefaultLanguage = "no";
    }
}
