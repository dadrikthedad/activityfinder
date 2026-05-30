using System.ComponentModel.DataAnnotations;

namespace AFBack.Configurations.Options;

public class ProxyOptions
{
    public const string SectionName = "ProxyRanges";

    [Required]
    public List<string> Ranges { get; set; } = [];
}
