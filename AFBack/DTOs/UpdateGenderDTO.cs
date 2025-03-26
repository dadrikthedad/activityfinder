using System.ComponentModel.DataAnnotations;
using AFBack.Models;

namespace AFBack.DTOs;

public class UpdateGenderDTO
{
    [Required]
    [EnumDataType(typeof(Gender))]
    public Gender Gender { get; set; }
}