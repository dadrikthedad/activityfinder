using AFBack.Features.Auth.Models;

namespace AFBack.Models;

using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
// Klassen som kobler brukeren opp mot en activitet og vi setter spesifikke AppUser-egenskaper som kun tilhørere hver bruker til hver akitvitet.


public class UserActivity
{
    [Key, ForeignKey("AppUser")]
    public int UserId { get; set; }
    public AppUser User { get; set; }
    
    public int ActivityId { get; set; }
    public Activity Activity { get; set; }
    
    public int? Score { get; set; }
    public int? SkillLevel { get; set; }
    public string? ActivityBio { get; set; }
}
