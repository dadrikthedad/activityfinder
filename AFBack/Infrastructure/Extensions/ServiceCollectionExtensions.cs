using System.Text.Json;
using System.Text.Json.Serialization;
using AFBack.Configuration;
using AFBack.Controllers;
using AFBack.Data;
using AFBack.Features.Cache;
using AFBack.Features.Cache.Interface;
using AFBack.Features.MessageBroadcast.Interface;
using AFBack.Features.MessageBroadcast.Service;
using AFBack.Features.SendMessage.Factories;
using AFBack.Features.SendMessage.Interface;
using AFBack.Features.SendMessage.ResponseBuilder;
using AFBack.Features.SendMessage.Services;
using AFBack.Features.SendMessage.Validators;
using AFBack.Infrastructure.Middleware;
using AFBack.Infrastructure.Services;
using AFBack.Interface;
using AFBack.Interface.Repository;
using AFBack.Interface.Services;
using AFBack.Models;
using AFBack.Services;
using AFBack.Services.Crypto;
using AFBack.Services.Maintenance.Tasks;
using AFBack.Services.User;
using Azure.Identity;
using Azure.Security.KeyVault.Secrets;
using Azure.Storage.Blobs;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace AFBack.Infrastructure.Extensions;

public static class ServiceCollectionExtensions
{
    
    /// <summary>
    /// Her legger vi til hovedinfrastrukturen til Program.cs. Dette må være tidlig
    /// </summary>
    /// <param name="services"></param>
    /// <param name="configuration"></param>
    /// <returns></returns>
    /// <exception cref="Exception"></exception>
    public static IServiceCollection AddCoreInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        // ===== DATABASE PostgreSQL=====
        var connectionString = Environment.GetEnvironmentVariable("DB_CONNECTION_STRING") ??
                               configuration.GetConnectionString("DefaultConnection") ??
                               throw new Exception("Database connection string is missing.");
        
        services.AddDbContext<ApplicationDbContext>(options => options.UseNpgsql(connectionString));
        
        
        // ===== AZURE SERVICES =====
        // Må være tidlig
        string? keyVaultUrl = configuration["KeyVault:Url"];
        if (!string.IsNullOrEmpty(keyVaultUrl))
        {
            services.AddSingleton(new SecretClient(new Uri(keyVaultUrl), new DefaultAzureCredential()));
        }
        // Kobler oss til blob-databasen
        var blobConnectionString = Environment.GetEnvironmentVariable("AZURE_BLOB_CONNECTION_STRING")
                                   ?? throw new Exception("AZURE_BLOB_CONNECTION_STRING is not set.");
        services.AddSingleton(new BlobServiceClient(blobConnectionString));
        
        // ===== APPLICATION INSIGHT =====
        
        var appInsightsConnectionString = Environment.GetEnvironmentVariable("APPLICATIONINSIGHTS_CONNECTION_STRING");
        if (!string.IsNullOrEmpty(appInsightsConnectionString))
            services.AddApplicationInsightsTelemetry(options =>
            {
                options.ConnectionString = appInsightsConnectionString;
                options.EnableAdaptiveSampling = true; // Reduserer kostnader
                options.EnableDependencyTrackingTelemetryModule  = true; // denne tracker HTTP og database-calls
                options.EnablePerformanceCounterCollectionModule = true; // Performance metrics? Må sjekke ut

            });
        
        // ===== CACHING =====
        services.AddMemoryCache();
        services.AddSingleton<ISendMessageCache, SendMessageCache>();
        services.AddSingleton<IUserCache, UserCache>();
        
        // ===== HTTP CLIENT =====
        // Brukes til flere tjenester
        services.AddHttpClient<GeolocationService>();
        
        // ===== EXCEPTION HANDLING =====
        services.AddExceptionHandler<GlobalExceptionHandler>();
        services.AddProblemDetails();
        
        
        return services;
    }
    
    /// <summary>
    /// Vi legger til SiglanR med konfiguration om å ha CamelCase og JSON-string
    /// </summary>
    /// <param name="services"></param>
    /// <returns></returns>
    public static IServiceCollection AddSignalr(this IServiceCollection services)
    {
        services.AddSignalR()
            .AddJsonProtocol(options =>
            {
                options.PayloadSerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase; 
                options.PayloadSerializerOptions.Converters.Add(new JsonStringEnumConverter());
            });
        
        services.AddSingleton<IUserIdProvider, CustomUserIdProvider>();
        
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
        services.Configure<IpBanOptions>(
            configuration.GetSection("IpBan"));
        services.AddSingleton<IIpBanService, IpBanService>();
        
        // ===== RATE LIMITING =====
        services.AddCustomRateLimiter();
        services.AddEmailRateLimit();
        
        
        
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
        services.AddScoped<ICleanupTask, OnlineStatusCleanupTask>();
        services.AddScoped<ICleanupTask, SyncEventsCleanupTask>();
        services.AddScoped<ICleanupTask, IpBanCleanupTask>();
        services.AddScoped<ICleanupTask, RefreshTokenCleanupTask>();
        
        return services;
    }
    
    /// <summary>
    /// Legger til repositories
    /// </summary>
    /// <param name="services"></param>
    /// <returns></returns>
    public static IServiceCollection AddRepositories(this IServiceCollection services)
    {
        // ===== REPOSITORIES =====
        services.AddScoped<IConversationRepository, ConversationRepository>();
        services.AddScoped<IMessageRepository, MessageRepository>();
        services.AddScoped<IUserRepository, UserRepository>();
        services.AddScoped<IUserBlockRepository, UserBlockRepository>();
        
        return services;
    }
    
    /// <summary>
    /// Legger til alle business servicene
    /// </summary>
    /// <param name="services"></param>
    /// <returns></returns>
    public static IServiceCollection AddBusinessServices(this IServiceCollection services)
    {
        // ===== AUTHENTICATION & USER SERVICES =====
        services.AddScoped<AuthService>();
        services.AddScoped<UserService, UserService>();
        services.AddScoped<EmailService, EmailService>();
        
        // ===== CONTROLLER SERVICES =====
        services.AddScoped<ResponseService>(); //✅
        
        // ===== RELATIONSHIPSERVICES =====
        
        
        // ===== MESSAGE SERVICES =====
        services.AddScoped<ISendMessageService, SendMessageService>(); // ✅
        services.AddScoped<IMessageService, MessageService>();
        services.AddScoped<IReactionService, ReactionService>();
        
        
        // ===== NOTIFICATION SERVICES =====
        services.AddScoped<INotificationService, NotificationService>();
        
        // ===== MESSAGE NOTIFICATION SERVICES =====
        
        
        // ===== MESSAGE BROADCAST SERVICES =====
        services.AddScoped<IMessageBroadcastService, MessageBroadcastService>(); // ✅
        services.AddScoped<IMessageNotificationService, MessageNotificationService>();
        services.AddScoped<ISyncService, SyncService>();
        
        // ===== FILES =====
        services.AddScoped<IFileService, FileService>();
        
        
        // ===== VALIDATORS =====
        services.AddScoped<ISendMessageValidator, SendMessageValidator>();
        
        // ===== FACTORIES =====
        services.AddScoped<ISendMessageFactory, SendMessageFactory>();
        
        // ===== RESPONSE BUILDERS =====
        services.AddScoped<ISendMessageResponseBuilder, SendMessageResponseBuilder>();
        
        // Til refaktorering
        services.AddScoped<ConversationService>();
        services.AddScoped<GroupNotificationService>();
        services.AddScoped<BootstrapService>();
        services.AddScoped<FriendService>();
        services.AddScoped<UserOnlineService>();
        services.AddScoped<NotificationSyncService>();
        services.AddScoped<SupportService>();
        services.AddScoped<E2EEService>();
        services.AddScoped<BlockService, BlockService>();
        services.AddSingleton<CountryService>();

        return services;
    }
}
