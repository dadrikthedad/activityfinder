using System.ComponentModel.DataAnnotations;

namespace AFBack.DTOs.Crypto;

public class SecretKeyPhraseDTO
{
    [Required(ErrorMessage  = "KeyPhrase is required.")]
    [MinLength(1, ErrorMessage = "KeyPhrase can't be empty.")]
    public string Key { get; set; }      // Selve nøkkelen
}