using System.Text.Json;
using System.Text.Json.Serialization;
using AFBack.Configurations.Options;
using AFBack.Data;
using AFBack.Features.Auth.Models;
using AFBack.Features.Auth.Services;
using AFBack.Features.Auth.Services.Interfaces;
using AFBack.Features.SignalR.Providers;
using AFBack.Features.SignalR.Services;
using AFBack.Infrastructure.BackgroundJobs;
using AFBack.Infrastructure.Cache;
using AFBack.Infrastructure.Cleanup;
using AFBack.Infrastructure.Cleanup.Tasks;
using AFBack.Infrastructure.Security.Extensions;
using AFBack.Infrastructure.Security.Services;
using AFBack.Infrastructure.Transactions;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.JsonWebTokens;
using StackExchange.Redis;
using IHubConnectionService = AFBack.Features.SignalR.Services.IHubConnectionService;

namespace AFBack.Infrastructure.Extensions.BuilderExtensions;

public static class ServiceCollectionExtensions
{
    /// <summary>
    /// Konfigurerer PostgreSQL database med Entity Framework Core
    /// </summary>
    public static IServiceCollection AddDatabase(this IServiceCollection services)
    {
        services.AddDbContext<AppDbContext>((sp, options) =>
        {
            var connectionStrings = sp.GetRequiredService<IOptions<ConnectionStringOptions>>().Value;
            options.UseNpgsql(connectionStrings.DatabaseConnection);
        });

        services.AddScoped<ITransactionService, TransactionService>();

        return services;
    }

    /// <summary>
    /// Konfigurerer Redis distributed cache og in-memory cache
    /// </summary>
    public static IServiceCollection AddCaching(this IServiceCollection services)
    {
        services.AddSingleton<IConnectionMultiplexer>(sp =>
        {
            var connectionStrings = sp.GetRequiredService<IOptions<ConnectionStringOptions>>().Value;
            return ConnectionMultiplexer.Connect(connectionStrings.Redis);
        });

        services.AddStackExchangeRedisCache(options =>
        {
            options.ConnectionMultiplexerFactory = () =>
            {
                var multiplexer = services.BuildServiceProvider()
                    .GetRequiredService<IConnectionMultiplexer>();
                return Task.FromResult(multiplexer);
            };
            options.InstanceName = "AFBack:";
        });

        services.AddMemoryCache();
        services.AddSingleton<ICanSendCache, CanSendCache>();
        services.AddSingleton<IUserSummaryCacheService, UserSummaryCacheService>();

        return services;
    }

    /// <summary>
    /// Setter opp Identity, Jwt og policies
    /// </summary>
    public static IServiceCollection AddIdentityAndAuthentication(this IServiceCollection services)
    {
        services.ConfigureOptions<ConfigureJwtBearerOptions>();
        services.AddScoped<IJwtService, JwtService>();

        services.AddIdentityCore<AppUser>(options =>
            {
                options.Password.RequireDigit = true;
                options.Password.RequireLowercase = true;
                options.Password.RequireUppercase = true;
                options.Password.RequireNonAlphanumeric = false;
                options.Password.RequiredLength = 8;

                options.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(5);
                options.Lockout.MaxFailedAccessAttempts = 5;
                options.Lockout.AllowedForNewUsers = true;

                options.User.RequireUniqueEmail = true;
            })
            .AddRoles<IdentityRole>()
            .AddEntityFrameworkStores<AppDbContext>()
            .AddDefaultTokenProviders();

        JsonWebTokenHandler.DefaultInboundClaimTypeMap.Clear();

        services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
            .AddJwtBearer();

        services.AddAuthorization();

        services.AddScoped<PasswordHashService>();
        services.AddScoped<IPasswordHashService>(sp => sp.GetRequiredService<PasswordHashService>());
        services.AddScoped<IPasswordHasher<AppUser>>(sp => sp.GetRequiredService<PasswordHashService>());

        return services;
    }

    /// <summary>
    /// Legger til sikkerhetsrelaterte servicer
    /// </summary>
    public static IServiceCollection AddSecurityServices(this IServiceCollection services)
    {
        services.AddSingleton<IIpBanService, IpBanService>();
        services.AddScoped<ISuspiciousActivityService, SuspiciousActivityService>();

        services.AddCustomRateLimiter();
        services.AddSingleton<ISmsRateLimitService, SmsRateLimitService>();
        services.AddSingleton<IEmailRateLimitService, EmailRateLimitService>();
        services.AddScoped<IRateLimitGuardService, RateLimitGuardService>();

        return services;
    }

    /// <summary>
    /// Konfigurer SignalR med camelCase og JSON-string på Enums
    /// </summary>
    public static IServiceCollection AddSignalRServices(this IServiceCollection services)
    {
        services.AddSignalR()
            .AddJsonProtocol(options =>
            {
                options.PayloadSerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
                options.PayloadSerializerOptions.Converters.Add(new JsonStringEnumConverter());
            });

        services.AddSingleton<IUserIdProvider, CustomUserIdProvider>();
        services.AddScoped<IHubConnectionService, HubConnectionService>();
        services.AddSingleton<IConversationPresenceService, ConversationPresenceService>();
        services.AddScoped<ISignalRNotificationService, SignalRNotificationService>();

        return services;
    }

    /// <summary>
    /// Legger til bakgrunnsjobber, cleanup og queuing
    /// </summary>
    public static IServiceCollection AddBackgroundServices(this IServiceCollection services)
    {
        services.AddSingleton<IBackgroundTaskQueue, BackgroundTaskQueue>();
        services.AddHostedService<QueuedHostedService>();

        services.AddHostedService<MaintenanceCleanupService>();

        services.AddScoped<ICleanupTask, ExpiredTokenCleanupTask>();
        services.AddScoped<ICleanupTask, UnverifiedUserCleanupTask>();
        services.AddScoped<ICleanupTask, EmailRateLimitCleanUpTask>();
        services.AddScoped<ICleanupTask, SmsRateLimitCleanupTask>();
        services.AddScoped<ICleanupTask, SyncEventsCleanupTask>();
        services.AddScoped<ICleanupTask, IpBanCleanupTask>();
        services.AddScoped<ICleanupTask, StaleConnectionCleanupTask>();

        return services;
    }
}
