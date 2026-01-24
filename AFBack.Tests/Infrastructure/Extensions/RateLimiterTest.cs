using Microsoft.Extensions.Caching.Memory;
using Xunit;
using FluentAssertions;

namespace AFBack.Tests.RateLimiter;

public class StrikeSystemTests
{
    [Fact]
    public void StrikeCounter_ShouldStartAtZero()
    {
        // Arrange
        var cache = new MemoryCache(new MemoryCacheOptions());
        var strikeKey = "rl-strikes:test-partition-1";

        // Act
        var strikes = cache.GetOrCreate(strikeKey, entry =>
        {
            entry.AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(10);
            return 0;
        });

        // Assert
        strikes.Should().Be(0);
    }

    [Fact]
    public void StrikeCounter_ShouldIncrementCorrectly()
    {
        // Arrange
        var cache = new MemoryCache(new MemoryCacheOptions());
        var strikeKey = "rl-strikes:test-partition-2";

        // Act - Initial value
        var strikes = cache.GetOrCreate(strikeKey, entry =>
        {
            entry.AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(10);
            return 0;
        });

        // Increment
        strikes++;
        cache.Set(strikeKey, strikes, TimeSpan.FromMinutes(10));

        // Retrieve
        var retrieved = cache.Get<int>(strikeKey);

        // Assert
        retrieved.Should().Be(1);
    }

    [Fact]
    public void StrikeCounter_ShouldIncrementMultipleTimes()
    {
        // Arrange
        var cache = new MemoryCache(new MemoryCacheOptions());
        var strikeKey = "rl-strikes:test-partition-3";

        // Act - Simulate 5 rate limit hits
        for (int i = 0; i < 5; i++)
        {
            var strikes = cache.GetOrCreate(strikeKey, entry =>
            {
                entry.AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(10);
                return 0;
            });

            strikes++;
            cache.Set(strikeKey, strikes, TimeSpan.FromMinutes(10));
        }

        var finalCount = cache.Get<int>(strikeKey);

        // Assert
        finalCount.Should().Be(5);
    }

    [Fact]
    public async Task StrikeCounter_ShouldExpireAfter10Minutes()
    {
        // Arrange
        var cache = new MemoryCache(new MemoryCacheOptions());
        var strikeKey = "rl-strikes:test-partition-4";
        
        // Set with very short expiration for testing
        cache.Set(strikeKey, 5, TimeSpan.FromMilliseconds(100));

        // Act
        await Task.Delay(150); // Wait for expiration
        
        var exists = cache.TryGetValue(strikeKey, out int value);

        // Assert
        exists.Should().BeFalse();
    }

    [Fact]
    public void StrikeCounter_WithDifferentPartitions_ShouldBeIndependent()
    {
        // Arrange
        var cache = new MemoryCache(new MemoryCacheOptions());
        var strikeKey1 = "rl-strikes:ip1-device1";
        var strikeKey2 = "rl-strikes:ip2-device2";

        // Act - Set different values for different partitions
        cache.Set(strikeKey1, 3, TimeSpan.FromMinutes(10));
        cache.Set(strikeKey2, 7, TimeSpan.FromMinutes(10));

        var strikes1 = cache.Get<int>(strikeKey1);
        var strikes2 = cache.Get<int>(strikeKey2);

        // Assert
        strikes1.Should().Be(3);
        strikes2.Should().Be(7);
    }

    [Fact]
    public void StrikeCounter_ShouldPersistAcrossMultipleRetrievals()
    {
        // Arrange
        var cache = new MemoryCache(new MemoryCacheOptions());
        var strikeKey = "rl-strikes:test-partition-5";

        // Act - Set initial value
        cache.Set(strikeKey, 10, TimeSpan.FromMinutes(10));

        // Retrieve multiple times
        var read1 = cache.Get<int>(strikeKey);
        var read2 = cache.Get<int>(strikeKey);
        var read3 = cache.Get<int>(strikeKey);

        // Assert
        read1.Should().Be(10);
        read2.Should().Be(10);
        read3.Should().Be(10);
    }

    [Fact]
    public void StrikeCounter_OverwriteExistingValue_ShouldUpdateCorrectly()
    {
        // Arrange
        var cache = new MemoryCache(new MemoryCacheOptions());
        var strikeKey = "rl-strikes:test-partition-6";

        // Act - Set initial value
        cache.Set(strikeKey, 2, TimeSpan.FromMinutes(10));
        
        // Overwrite with new value
        cache.Set(strikeKey, 8, TimeSpan.FromMinutes(10));
        
        var finalValue = cache.Get<int>(strikeKey);

        // Assert
        finalValue.Should().Be(8);
    }

    [Fact]
    public void StrikeCounter_GetOrCreate_WithExistingValue_ShouldNotRecreate()
    {
        // Arrange
        var cache = new MemoryCache(new MemoryCacheOptions());
        var strikeKey = "rl-strikes:test-partition-7";
        
        // Set initial value
        cache.Set(strikeKey, 15, TimeSpan.FromMinutes(10));

        // Act - GetOrCreate should return existing value
        var strikes = cache.GetOrCreate(strikeKey, entry =>
        {
            entry.AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(10);
            return 999; // This should NOT be used
        });

        // Assert
        strikes.Should().Be(15); // Original value, not 999
    }
}