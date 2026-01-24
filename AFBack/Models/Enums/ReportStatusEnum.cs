using System.ComponentModel.DataAnnotations;

namespace AFBack.Models.Enums;

public enum ReportStatusEnum
{
    [Display(Name = "Open")]
    Open = 1,
    
    [Display(Name = "In Progress")]
    InProgress = 2,
    
    [Display(Name = "Waiting for Info")]
    WaitingForInfo = 3,
    
    [Display(Name = "Under Review")]
    UnderReview = 4,
    
    [Display(Name = "Resolved")]
    Resolved = 5,
    
    [Display(Name = "Closed")]
    Closed = 6,
    
    [Display(Name = "Duplicate")]
    Duplicate = 7,
    
    [Display(Name = "Won't Fix")]
    WontFix = 8,
    
    [Display(Name = "Cannot Reproduce")]
    CannotReproduce = 9
}
