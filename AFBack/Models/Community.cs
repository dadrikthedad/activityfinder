namespace AFBack.Models;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

public class Community
{   
    [Key]
    public int CommunityId { get; set; }
}