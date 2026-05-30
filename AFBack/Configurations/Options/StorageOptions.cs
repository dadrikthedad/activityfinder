using System.ComponentModel.DataAnnotations;

namespace AFBack.Configurations.Options;

public class StorageOptions
{
    public const string SectionName = "Storage";

    [Required]
    public string BlobAccountUrl { get; set; } = string.Empty;

    [Required]
    public string AccessKey { get; set; } = string.Empty;

    [Required]
    public string SecretKey { get; set; } = string.Empty;

    public StorageContainersOptions Containers { get; set; } = new();
}

public class StorageContainersOptions
{
    [Required]
    public string EncryptedFiles { get; set; } = string.Empty;

    [Required]
    public string PublicImages { get; set; } = string.Empty;

    [Required]
    public string PrivateFiles { get; set; } = string.Empty;
}
