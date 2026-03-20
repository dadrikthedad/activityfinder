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
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.JsonWebTokens;
using StackExchange.Redis;
using IHubConnectionService = AFBack.Features.SignalR.Services.IHubConnectionService;

namespace AFBack.Infrastructure.Extensions.BuilderExtensions;

public static class ServiceCollectionExtensions
{
    
    /// <summary>
    /// Konfigurerer PostgreSQL database med Entity Framework Core
    /// </summary>
    public static IServiceCollection AddDatabase(this IServiceCollection services, IConfiguration configuration)
    {
        var connectionString = configuration.GetConnectionString("DatabaseConnection")
                               ?? throw new InvalidOperationException("ConnectionStrings:DatabaseConnection " +
                                                                      "is not configured");
        Console.WriteLine($"DB Connection: {connectionString}");

        services.AddDbContext<AppDbContext>(options => options.UseNpgsql(connectionString));

        return services;
    }
    
    
    /// <summary>
    /// Konfigurerer Redis distributed cache og in-memory cache
    /// </summary>
    public static IServiceCollection AddCaching(this IServiceCollection services, IConfiguration configuration)
    {
        // Redis distributed cache
        var redisConnectionString = configuration.GetConnectionString("Redis")
                                    ?? throw new InvalidOperationException("ConnectionStrings:Redis is not configured");
        
        // En tilkobling til Redis som kan brukes av flere servicer med full tilgang til alt av Redis-funksjonaltiet
        var multiplexer = ConnectionMultiplexer.Connect(redisConnectionString);
        services.AddSingleton<IConnectionMultiplexer>(multiplexer);
        
        // Enkelt cache mot Redis - Gir oss mulighet til å hente ut data fra Redis med get/set
        services.AddStackExchangeRedisCache(options =>
        {
            options.Configuration = redisConnectionString;
            options.InstanceName = "AFBack:";
        });

        // In-memory cache
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
        // Register og valider JwtSettings
        services.AddOptions<JwtSettings>()
            .BindConfiguration(JwtSettings.SectionName)
            .ValidateDataAnnotations()
            .ValidateOnStart();
         
        // Registerer JwtBearer options som vanligvis er i AddAuthenticaiton
        services.ConfigureOptions<ConfigureJwtBearerOptions>();
         
        // Registerer JwtService
        services.AddScoped<IJwtService, JwtService>();
         
         
        // Konfigurer Identity med vår egen bruker
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
        
        // Her forteller vi ASP.NET Core at vi skal bruke JWT-tokens for autentisering
        services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
            .AddJwtBearer();
        
        services.AddAuthorization();
        
        // Registrere PasswordHashService og overstyre Identity sin
        services.AddScoped<PasswordHashService>();
        services.AddScoped<IPasswordHashService>(sp => sp.GetRequiredService<PasswordHashService>());
        services.AddScoped<IPasswordHasher<AppUser>>(sp => sp.GetRequiredService<PasswordHashService>());
        
        return services;
    }

    
    /// <summary>
    /// Legger til sikkerhetsrelatert servicer til Programmet
    /// </summary>
    /// <param name="services"></param>
    /// <param name="configuration"></param>
    /// <returns></returns>
    public static IServiceCollection AddSecurityServices(this IServiceCollection services, IConfiguration configuration)
    {
        // ===== IP BAN =====
        services.AddSingleton<IIpBanService, IpBanService>();
        services.AddScoped<ISuspiciousActivityService, SuspiciousActivityService>();
        
        // ===== RATE LIMITING =====
        services.AddCustomRateLimiter();
        services.AddSingleton<ISmsRateLimitService, SmsRateLimitService>();
        services.AddSingleton<IEmailRateLimitService, EmailRateLimitService>();
        services.AddScoped<IRateLimitGuardService, RateLimitGuardService>();
        
        return services;
    }
    
    /// <summary>
    /// Konfigurer SignalR med å bruke camelCase og JSON-string på Enums
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
    /// Legger til det som kjører i bakgrunn, cleanup og queuing
    /// </summary>
    /// <param name="services"></param>
    /// <returns></returns>
    public static IServiceCollection AddBackgroundServices(this IServiceCollection services)
    {
        // ===== BACKGROUND TASK QUEUE =====
        services.AddSingleton<IBackgroundTaskQueue, BackgroundTaskQueue>();
        services.AddHostedService<QueuedHostedService>();
        
        // ===== MAINTENANCE =====
        services.AddHostedService<MaintenanceCleanupService>();
        
        // ===== CLEANUP TASKS =====
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
