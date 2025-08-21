using System.ComponentModel.DataAnnotations;

namespace AFBack.Constants;

public enum ReportTypeEnum
{
    [Display(Name = "Bug Report")]
    BugReport = 1,
        
    [Display(Name = "User Report")]
    UserReport = 2,
        
    [Display(Name = "Feature Request")]
    FeatureRequest = 3,
        
    [Display(Name = "Other")]
    Other = 4
}