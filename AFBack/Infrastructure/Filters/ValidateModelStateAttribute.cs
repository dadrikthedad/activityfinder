using AFBack.Infrastructure.DTO;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace AFBack.Infrastructure.Filters;

/// <summary>
/// Denne klassen gjør at vi ikke trenger å validere attributer som kommer via requester. Fanger det og logger det for
/// oss
/// </summary>
public class ValidateModelStateAttribute : ActionFilterAttribute
{
    public override void OnActionExecuting(ActionExecutingContext context)
    {
        if (context.ModelState.IsValid)
            return;
        
        // Henter og samler alle valideringsfeilene
        var errors = context.ModelState
            .Where(ms => ms.Value?.Errors.Count > 0)
                .SelectMany(ms => ms.Value!.Errors.Select(e=> new
            {
                Field = ms.Key,
                Error = !string.IsNullOrEmpty(e.ErrorMessage)
                    ? e.ErrorMessage
                    : e.Exception?.Message ?? "Unknown error"
            }))
            .ToList();
        
        // Formaterer melding
        var errorMessage = string.Join("; ", errors.Select(e =>
            string.IsNullOrEmpty(e.Field) ? e.Error : $"{e.Field}: {e.Error}"));

        var logger = context.HttpContext.RequestServices
            .GetService<ILogger<ValidateModelStateAttribute>>();
        
        // Logger valideringsfeil
        logger?.LogWarning(
            "Model validation failed for {HttpMethod} {Path}. AppUser: {UserId}. Errors: {Errors}",
            context.HttpContext.Request.Method,
            context.HttpContext.Request.Path,
            context.HttpContext.User.Identity?.Name ?? "Anonymous",
            errorMessage);

        context.Result = new BadRequestObjectResult(new ApiResponse<object>
        {
            Success = false,
            Message = errorMessage,
            Data = null
        });
    }
}
