namespace AFBack.Configurations.Options;

public static class ImageFileConfig
{
    /// <summary>
    /// Maks størrelse for bilder (5 MB)
    /// </summary>
    public const long MaxSizeInBytes = 25 * 1024 * 1024;

    /// <summary>
    /// Tillatte extensions for bilder
    /// </summary>
    public static readonly HashSet<string> AllowedExtensions = [".jpg", ".jpeg", ".png", ".webp"];

    /// <summary>
    /// Tillatte content types for bilder
    /// </summary>
    public static readonly HashSet<string> AllowedContentTypes =
    [
        "image/jpeg",
        "image/png",
        "image/webp"
    ];

    /// <summary>
    /// Storage key prefix for profilbilder
    /// </summary>
    public const string ProfileImagePrefix = "profiles";

    /// <summary>
    /// Storage key prefix for gruppebilder
    /// </summary>
    public const string GroupImagePrefix = "groups";
}
