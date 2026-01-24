using System.Security.Claims;
using AFBack.Features.Exceptions.CustomExceptions;
using AFBack.Infrastructure.Middleware;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AFBack.Features.Exceptions;

public class GlobalExceptionHandler(ILogger<GlobalExceptionHandler> logger, IHostEnvironment env) : IExceptionHandler
{
    /// <summary>
    /// Fanger opp alle exceptions vi ikke håndterer selv med egendefinerte feilmeldinger og logginger
    /// </summary>
    /// <param name="httpContext"></param>
    /// <param name="exception"></param>
    /// <param name="cancellationToken"></param>
    /// <returns></returns>
    public async ValueTask<bool> TryHandleAsync(HttpContext httpContext, Exception exception,
        CancellationToken cancellationToken)
    {
        // Mapper exceptions til riktig statuskoder, titler og beskrivelser
        var (statusCode, title, detail) = exception switch
        {
            ValidationException ex => (StatusCodes.Status400BadRequest, "Validation Error", ex.Message),
            ArgumentException argEx => (StatusCodes.Status400BadRequest, "Bad Request", argEx.Message),
            KeyNotFoundException => (StatusCodes.Status404NotFound, "Not Found",
                "The requested resource was not found"),
            NotFoundException ex => (StatusCodes.Status404NotFound, "Not Found", ex.Message),
            UnauthorizedAccessException ex => (StatusCodes.Status403Forbidden, "Forbidden", ex.Message),
            InvalidOperationException ex => (StatusCodes.Status409Conflict, "Operation Conflict", ex.Message),
            DbUpdateException => (StatusCodes.Status409Conflict, "Database Conflict", "A database conflict occurred"),
            AuthorizationException ex => (StatusCodes.Status401Unauthorized, "Unauthorized", ex.Message), 
            UserNotFoundException ex => (StatusCodes.Status400BadRequest, "Bad Request", ex.Message),
            
            _ => (StatusCodes.Status500InternalServerError, "Server Error", "An unexpected error occurred")
        };
        
        // Her henter vi userId hvis er i token
        var userId = httpContext.User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        // Henter ut Url-pathen
        var requestPath = httpContext.Request.Path;
        // Henter ut HTTP-metode, altså Get, Post, Delete etc.
        var method = httpContext.Request.Method;
        // Unik ID for tracen, kan være nyttig for feilsøking
        var traceId = httpContext.TraceIdentifier;
        
        // Dette er en loggingscope som fungerer godt med AppInsight. Feltene under blir metadata som bruker, statuskode,
        // exception type, traceid, url og metode
        using (logger.BeginScope(new Dictionary<string, object>
               {
                   ["UserId"] = userId ?? "anonymous",
                   ["RequestPath"] = requestPath.ToString(),
                   ["Method"] = method,
                   ["StatusCode"] = statusCode,
                   ["TraceId"] = traceId,
                   ["ExceptionType"] = exception.GetType().Name
               }))
        {  
            // Logging basert på statuskodene
            if (statusCode >= 500)
            {
                logger.LogError(exception, "Unhandled server error. " +
                                           "Path: {RequestPath}, Method: {Method}, StatusCode: {StatusCode}, " +
                                           "UserId: {UserId}, TraceId: {TraceId}",
                    requestPath, method, statusCode, userId, traceId);
            }
            else if (exception is AuthorizationException)
            {
                var ipAddress = httpContext.Connection.RemoteIpAddress?.ToString();
                var userAgent = httpContext.Request.Headers["AppUser-Agent"].ToString();

                using (logger.BeginScope(new Dictionary<string, object>
                       {
                           ["IPAddress"] = ipAddress ?? "unknown",
                           ["UserAgent"] = userAgent
                       }))
                {
                    logger.LogWarning("Authorization failed. " +
                                      "Path: {RequestPath}, Method: {Method}, " +
                                      "UserId: {UserId}, IP: {IpAddress}, Message: {Message}, TraceId: {TraceId}",
                        requestPath, method, userId, ipAddress, exception.Message, traceId);
                }
            }
            else if (statusCode == 401 && exception is not AuthorizationException)
            {
                logger.LogWarning("Authorization failed. " +
                                  "Path: {RequestPath}, Method: {Method}, " +
                                  "UserId: {UserId}, Message: {Message}, TraceId: {TraceId}",
                    requestPath, method, userId, exception.Message, traceId);
            }
            else if (statusCode == 404)
            {
                logger.LogWarning("Resource not found. " +
                                  "Path: {RequestPath}, Method: {Method}," +
                                  "UserId: {UserId}, Message: {Message}", requestPath, method, userId,
                    exception.Message);
            }
            else
            {
                logger.LogWarning(exception,
                    "Client error occurred. " +
                    "Path: {RequestPath}, Method: {Method}, StatusCode: {StatusCode}, " +
                    "UserId: {UserId}, Message: {Message}", requestPath, method, statusCode, userId, exception.Message);
            }
        }
        
        // Dette er et ProblemDetails-objekt. Det er et standardisert objektmodell for feil i web-APIer
        var problemDetails = new ProblemDetails
        {
            Status = statusCode,
            Title = title,
            // Hvis kun hele feilmeldingen hvis vi er i produksjon
            Detail = env.IsDevelopment() ? exception.Message : detail,
            Instance = requestPath
        };
        
        // Legger til ekstra information hvis det er vår egene ValidationException
        if (exception is ValidationException validationException && validationException.Errors != null)
        {
            problemDetails.Extensions["errors"] = validationException.Errors;
        }
        
        // Hvis vi er i produksjon så legger vi til stackTrace og innerException for å få hele feilmeldingen
        if (env.IsDevelopment())
        {
            problemDetails.Extensions["stackTrace"] = exception.StackTrace;
            problemDetails.Extensions["innerException"] = exception.InnerException?.Message;
        }
        
        // Legger til trace og statusCode
        problemDetails.Extensions["traceId"] = traceId;
        httpContext.Response.StatusCode = statusCode;
        
        // Standard for ProblemDetails
        httpContext.Response.ContentType = "application/problem+json";
        // returner ProblemDetails-objektet som JSOn
        await httpContext.Response.WriteAsJsonAsync(problemDetails, cancellationToken);

        return true; // Vi sier ifra til Asp.Net Core at exception er håndtert og programmet stopper ikke
    }
}
