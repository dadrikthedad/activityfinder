namespace AFBack.Models;
using System.ComponentModel.DataAnnotations;

// Her er alle aktivitetene og dens egenskaper.
public class Activity
{
    [Key]
    public int ActivityId { get; set; }
    
}
