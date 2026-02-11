using System.ComponentModel.DataAnnotations;

namespace AFBack.Common.Validations;

/// <summary>
/// Validerer at verdien til attributen er høyere enn minimum Age, og lavere enn maximumAge.
/// Både minimum og maximum er optional. Fungerer på DateTime og DateOnly
/// </summary>
/// <param name="minimumAge">Minimum age som int</param>
/// <param name="maximumAge">Maximum age som int, optional</param>
public class NotInFutureAttribute(int minimumAge = 0, int maximumAge = 0) : ValidationAttribute
{
    protected override ValidationResult? IsValid(object? value, ValidationContext validationContext)
    {
        // TimeProvider gir oss dagens dato og klokkeslett
        var timeProvider = (TimeProvider?)validationContext.GetService(typeof(TimeProvider))
                           ?? TimeProvider.System;
        
        // Henter ut dagens dato
        var todaysDate = DateOnly.FromDateTime(timeProvider.GetUtcNow().DateTime);
        
        // Sjekker datatypen til verdien
        var date = value switch
        {
            DateOnly d => d,
            DateTime dt => DateOnly.FromDateTime(dt),
            _ => default
        };
        
        if (date == default)
            return new ValidationResult(
                "DateOfBirth attribute can only be used on DateOnly or DateTime properties.");
      
        if (date > todaysDate)
            return new ValidationResult("Date cannot be a date in the future.");
        
        // MinimumAge har en verdi
        if (minimumAge > 0)
        {
            var minimumDate = todaysDate.AddYears(-minimumAge);
            if (date > minimumDate)
            {
                var errorMessage = !string.IsNullOrEmpty(ErrorMessage)
                    ? ErrorMessage
                    : $"Date must be at least {minimumAge} years ago";
              
                return new ValidationResult(errorMessage);
            }
        }


        if (maximumAge > 0)
        {
            var maximumDate = todaysDate.AddYears(-maximumAge);
            if (date < maximumDate)
            {
                var errorMessage = !string.IsNullOrEmpty(ErrorMessage)
                    ? ErrorMessage
                    : $"Date cannot be more than {maximumAge} years ago.";
              
                return new ValidationResult(errorMessage);
            }
        }
        
        return ValidationResult.Success;
    }
}
