using System.ComponentModel.DataAnnotations;
using AFBack.Models;
using AFBack.Models.Auth;

public class GroupEventAffectedUser
{
    public int Id { get; set; }
    
    [Required]
    public int GroupEventId { get; set; }
    public GroupEvent GroupEvent { get; set; } = null!;
    
    [Required]
    public int UserId { get; set; }
    public AppUser AppUser { get; set; } = null!;
    
    // Composite index for performance
    // [Index(nameof(GroupEventId), nameof(UserId), IsUnique = true)]
}