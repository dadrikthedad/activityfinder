using System.Diagnostics;
using AFBack.Infrastructure.Cache;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Caching.Distributed;

namespace AFBack.Features.Testing.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class SignalRTestController(
    IDistributedCache distributedCache,
    IUserSummaryCacheService userSummaryCache)
    : ControllerBase
{
    
    /// <summary>
    /// Tester at Redis fungerer
    /// </summary>
    [HttpGet("redis")]
    public async Task<IActionResult> TestRedis()
    {
        try
        {
            await distributedCache.SetStringAsync("test:key", "Hello Redis!");
            var value = await distributedCache.GetStringAsync("test:key");
            await distributedCache.RemoveAsync("test:key");

            return Ok(new
            {
                Status = "Redis works",
                TestValue = value
            });
        }
        catch (Exception ex)
        {
            return Problem($"Redis error: {ex.Message}");
        }
    }
    
    /// <summary>
    /// Test endepunnkt for å sikre at Redis fungerer og cachings metodene fungerer
    /// </summary>
    [HttpGet("user-cache/{userId}")]
    public async Task<IActionResult> TestUserCache(string userId)
    {
        try
        {
            var sw = Stopwatch.StartNew();
            var user1 = await userSummaryCache.GetUserSummaryAsync(userId);
            var time1 = sw.ElapsedMilliseconds;

            sw.Restart();
            var user2 = await userSummaryCache.GetUserSummaryAsync(userId);
            var time2 = sw.ElapsedMilliseconds;

            return Ok(new
            {
                Status = "Cache works",
                User = user1,
                FirstCallMs = time1,
                SecondCallMs = time2,
                Speedup = time2 > 0
                    ? $"{(double)time1 / time2:F1}x"
                    : "Infinite"
            });
        }
        catch (Exception ex)
        {
            return Problem($"Cache error: {ex.Message}");
        }
    }
    
    
}

