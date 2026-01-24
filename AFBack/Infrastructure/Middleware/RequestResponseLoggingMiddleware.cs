using System.Text;
using System.Text.Json;
using AFBack.Infrastructure.Constants;
namespace AFBack.Infrastructure.Middleware;

/// <summary>
/// Fanger opp alle HTTP requester og responser, og logger payloaden (eventuelt sensurere sensitiv informasjon)
/// Brukes ikke i produksjon, kun under utvikling
/// </summary>
/// <param name="next"></param>
/// <param name="logger"></param>
public class RequestResponseLoggingMiddleware(RequestDelegate next, ILogger<RequestResponseLoggingMiddleware> logger)
{
    
    public async Task InvokeAsync(HttpContext context)
    {
        await LogRequest(context);

        var originalBodyStream = context.Response.Body;

        await using var responseBody = new MemoryStream();

        context.Response.Body = responseBody;

        try
        {
            await next(context);

            await LogResponse(context);
        }
        finally
        {
            await responseBody.CopyToAsync(originalBodyStream);
        }
    }

    private async Task LogRequest(HttpContext context)
    {
        context.Request.EnableBuffering();

        var request = context.Request;
        var userId = context.User
            .FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value ?? "anonymous";
        var ipAddress = context.Connection.RemoteIpAddress?.ToString();

        string? requestBody = null;

        if (request.ContentLength > 0 &&
            request.ContentType?.Contains("application/json") == true)
        {
            request.Body.Position = 0;
            using var reader = new StreamReader(
                request.Body,
                Encoding.UTF8,
                leaveOpen: true);

            var body = await reader.ReadToEndAsync();
            request.Body.Position = 0;

            requestBody = SanitizeRequestBody(body);
        }

        logger.LogInformation(
            "HTTP Request: {Method} {Path}{QueryString} - UserId {UserId}, IP: {IpAddress}, Body: {RequestBody},",
            request.Method, 
            request.Path,
            request.QueryString,
            userId,
            ipAddress,
            requestBody ?? "empty");
    }

    private async Task LogResponse(HttpContext context)
    {
        context.Response.Body.Seek(0, SeekOrigin.Begin);
        var responseBody = await new StreamReader(context.Response.Body).ReadToEndAsync();
        context.Response.Body.Seek(0, SeekOrigin.Begin);

        var request = context.Request;
        var userId = context.User
            .FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value ?? "anonymous";

        var bodyToLog = responseBody.Length > 2000
            ? $"[Response too large: {responseBody.Length} bytes]"
            : responseBody;
         
        logger.LogInformation(
            "HTTP Response: {Method} {Path} - StatusCode: {StatusCode}, UserId {UserId}, Body: {ResponseBody}",
            request.Method, 
            request.Path,
            context.Response.StatusCode,
            userId,
            bodyToLog);
        
    }

    private string SanitizeRequestBody(string body)
    {
        try
        {
            var jsonDoc = JsonDocument.Parse(body);
            var sanitized = SanitizeJsonElement(jsonDoc.RootElement);
            return JsonSerializer.Serialize(sanitized);
        }
        catch
        {
            return "[Non-JSON body]";
        }
    }

    private object SanitizeJsonElement(JsonElement element)
    {
        switch (element.ValueKind)
        {
            case JsonValueKind.Object:
                var obj = new Dictionary<string, object>();
                foreach (var property in element.EnumerateObject())
                {
                    if (SensitiveDataConstants.IsSensitive(property.Name))
                        obj[property.Name] = "***REDACTED***";
                    else
                        obj[property.Name] = SanitizeJsonElement(property.Value);
                }

                return obj;
            
            case JsonValueKind.Array:
                return element.EnumerateArray()
                    .Select(SanitizeJsonElement)
                    .ToList();
            
            case JsonValueKind.String:
                return element.GetString() ?? "";
            case JsonValueKind.Number:
                return element.GetDecimal();
            
            case JsonValueKind.True:
                case JsonValueKind.False:
                    return element.GetBoolean();
            
            case JsonValueKind.Null:
                return null!;
            
            default:
                return element.ToString();
        }
    }
}
