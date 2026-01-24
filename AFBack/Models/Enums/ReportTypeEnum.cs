using System.ComponentModel.DataAnnotations;

namespace AFBack.Models.Enums;

public enum ReportTypeEnum
{
    [Display(Name = "Bug Report")]
    BugReport = 1,
        
    [Display(Name = "AppUser Report")]
    UserReport = 2,
        
    [Display(Name = "Feature Request")]
    FeatureRequest = 3,
        
    [Display(Name = "Other")]
    Other = 4
}
