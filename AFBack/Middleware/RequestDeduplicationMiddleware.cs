using Microsoft.Extensions.Caching.Memory;

namespace AFBack.Middleware;

public class RequestDeduplicationMiddleware
{
    private static readonly MemoryCache _requestCache = new MemoryCache(new MemoryCacheOptions());
    private readonly RequestDelegate _next;
    private readonly ILogger<RequestDeduplicationMiddleware> _logger;

    public RequestDeduplicationMiddleware(RequestDelegate next, ILogger<RequestDeduplicationMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        var requestId = context.Request.Headers["X-Request-ID"].FirstOrDefault();
        
        if (!string.IsNullOrEmpty(requestId))
        {
            var cacheKey = $"request_{requestId}";
            
            if (_requestCache.TryGetValue(cacheKey, out _))
            {
                _logger.LogInformation("⚡ DEDUPE: Blocked duplicate request {RequestId} for {Path}", 
                    requestId, context.Request.Path);
                
                context.Response.StatusCode = StatusCodes.Status409Conflict;
                await context.Response.WriteAsync("Duplicate request");
                return;
            }
            
            _requestCache.Set(cacheKey, true, TimeSpan.FromSeconds(30));
        }
        
        await _next(context);
    }
}