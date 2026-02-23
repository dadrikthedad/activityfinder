using System.Text.Json;
using System.Text.Json.Serialization;
using AFBack.Cache;
using AFBack.Configurations.Options;
using AFBack.Data;
using AFBack.Features.Account.Services;
using AFBack.Features.Auth.Models;
using AFBack.Features.Auth.Repositories;
using AFBack.Features.Auth.Services;
using AFBack.Features.Auth.Services.Interfaces;
using AFBack.Features.Blocking.Repository;
using AFBack.Features.Blocking.Services;
using AFBack.Features.Broadcast.Services;
using AFBack.Features.Cache;
using AFBack.Features.Cache.Interface;
using AFBack.Features.CanSend.Repository;
using AFBack.Features.Conversation.Repository;
using AFBack.Features.Conversation.Services;
using AFBack.Features.Conversation.Validators;
using AFBack.Features.Exceptions;
using AFBack.Features.FileHandling.Services;
using AFBack.Features.FileHandling.Validators;
using AFBack.Features.Friendship.Repository;
using AFBack.Features.Geography.Services;
using AFBack.Features.MessageNotifications.Repository;
using AFBack.Features.MessageNotifications.Service;
using AFBack.Features.Messaging.Interface;
using AFBack.Features.Messaging.Repository;
using AFBack.Features.Messaging.Services;
using AFBack.Features.Messaging.Validators;
using AFBack.Features.Profile.Repository;
using AFBack.Features.Profile.Services;
using AFBack.Features.Settings.Repositories;
using AFBack.Features.Settings.Services;
using AFBack.Features.SignalR.Providers;
using AFBack.Features.SignalR.Services;
using AFBack.Features.SyncEvents.Repository;
using AFBack.Features.SyncEvents.Services;
using AFBack.Infrastructure.Cleanup;
using AFBack.Infrastructure.Email;
using AFBack.Infrastructure.Security.Extensions;
using AFBack.Infrastructure.Security.Repositories;
using AFBack.Infrastructure.Security.Services;
using AFBack.Infrastructure.Sms.Services;
using AFBack.Services;
using AFBack.Services.Crypto;
using AFBack.Services.Maintenance.Tasks;
using AFBack.Services.User;
using Azure.Communication.Email;
using Azure.Communication.Sms;
using Azure.Identity;
using Azure.Security.KeyVault.Secrets;
using Azure.Storage.Blobs;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.JsonWebTokens;
using EmailService = AFBack.Infrastructure.Email.EmailService;
using IHubConnectionService = AFBack.Features.SignalR.Services.IHubConnectionService;

namespace AFBack.Infrastructure.Extensions.ServiceExtensions;

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
        
        services.AddDbContext<AppDbContext>(options => options.UseNpgsql(connectionString));
        
        
        // ===== AZURE SERVICES =====
        // Må være tidlig
        string? keyVaultUrl = configuration["KeyVault:Url"];
        if (!string.IsNullOrEmpty(keyVaultUrl))
        {
            services.AddSingleton(new SecretClient(new Uri(keyVaultUrl), new DefaultAzureCredential()));
        }
        
        // Kobler oss til Azure Blob Storage via Managed Identity
        var blobAccountUrl = configuration["Azure:BlobAccountUrl"]
                             ?? throw new InvalidOperationException("Azure:BlobAccountUrl is not configured");
        services.AddSingleton(new BlobServiceClient(new Uri(blobAccountUrl), new DefaultAzureCredential()));
        services.AddScoped<IStorageService, AzureBlobStorageService>();
        services.AddSingleton<IBlobUrlBuilder, BlobUrlBuilder>();
        
        // ===== APPLICATION INSIGHT =====
        
        var appInsightsConnectionString = Environment.GetEnvironmentVariable("APPLICATIONINSIGHTS_CONNECTION_STRING");
        if (!string.IsNullOrEmpty(appInsightsConnectionString))
        {
            services.AddApplicationInsightsTelemetry(options =>
            {
                options.ConnectionString = appInsightsConnectionString;
                options.EnableAdaptiveSampling = true; // Reduserer kostnader
                options.EnableDependencyTrackingTelemetryModule  = true; // denne tracker HTTP og database-calls
                options.EnablePerformanceCounterCollectionModule = true; // Performance metrics? Må sjekke ut

            });
        }
        
        // ===== Redis Cache =====
        var redisConnectionString = Environment.GetEnvironmentVariable("REDIS_CONNECTION_STRING")
                                    ?? configuration.GetConnectionString("Redis")
                                    ?? throw new Exception("Redis connection string is missing. " +
                                                           "Set REDIS_CONNECTION_STRING environment variable or " +
                                                           "Redis connection string in appsettings.json");
            
        services.AddStackExchangeRedisCache(options =>
        {
            options.Configuration = redisConnectionString;
            options.InstanceName = "AFBack:";
        });
        
        // ===== CACHING =====
        services.AddMemoryCache();
        services.AddSingleton<ISendMessageCache, SendMessageCache>();
        services.AddSingleton<IUserSummaryCacheService, UserSummaryCacheService>();
        services.AddSingleton<IUserCache, UserCache>();
        
        // ===== HTTP CLIENT =====
        // Brukes til flere tjenester
        services.AddHttpClient<GeolocationService>();
    
        
        // ===== EMAIL & SMS =====
        var acsConnectionString = configuration["AzureCommunication:ConnectionString"];
        services.AddSingleton(new EmailClient(acsConnectionString));
        services.AddScoped<IEmailService, EmailService>();
        services.AddSingleton(new SmsClient(acsConnectionString));
        services.AddScoped<ISmsService, SmsService>();
        
        
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
        
        return services;
    }
    
    
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
        services.AddAuthentication(options =>
        {
            // Dette sikrer at vi sjekker JWT automatisk når vi får inn en request
            options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
            // Hvis brukeren ikke har med token så vå de en 401 Unathorized
            options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
            // Dette er bare backup og brukes hvis ikke noe annet er spesifisert. Feks hvis det er flere type
            // autentiseringsmuligheter i appen så kan man velge hvem det skal falles tilbake på
            options.DefaultScheme = JwtBearerDefaults.AuthenticationScheme;
        }).AddJwtBearer();
        
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
        // ===== AUTHENTICATION & USER SERVICES =====
        services.AddScoped<IUserRepository, UserRepository>();
        services.AddScoped<IRefreshTokenRepository, RefreshTokenRepository>();
        services.AddScoped<IUserDeviceRepository, UserDeviceRepository>();
        services.AddScoped<ILoginHistoryRepository, LoginHistoryRepository>();
        services.AddScoped<IIpBanRepository, IpBanRepository>();
        services.AddScoped<ISuspiciousActivityRepository, SuspiciousActivityRepository>();
        services.AddScoped<IVerificationInfoRepository, VerificationInfoRepository>();
        services.AddScoped<IProfileRepository, ProfileRepository>();
        services.AddScoped<ISettingsRepository, SettingsRepository>();
        
        
        services.AddScoped<IConversationRepository, ConversationRepository>();
        services.AddScoped<IMessageRepository, MessageRepository>();
        services.AddScoped<IUserBlockRepository, UserBlockRepository>();
        services.AddScoped<ICanSendRepository, CanSendRepository>();
        services.AddScoped<IMessageNotificationRepository, MessageNotificationRepository>();
        services.AddScoped<ISyncEventRepository, SyncEventRepository>();
        services.AddScoped<IDeviceSyncStateRepository, DeviceSyncStateRepository>();
        services.AddScoped<IFriendshipRepository, FriendshipRepository>();
        services.AddScoped<IConversationLeftRecordRepository, ConversationLeftRecordRepository>();
        
        
        
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
        services.AddScoped<IAuthService, AuthService>();
        services.AddScoped<IVerificationInfoService, VerificationInfoService>();
        services.AddScoped<ITokenService, TokenService>();
        services.AddScoped<IUserDeviceService, UserDeviceService>();
        services.AddScoped<ILoginHistoryService, LoginHistoryService>();
        services.AddScoped<IAccountVerificationService, AccountVerificationService>();
        services.AddScoped<IAccountChangeService, AccountChangeService>();
        services.AddScoped<IPasswordService, PasswordService>();
        services.AddScoped<IProfileService, ProfileService>();
        services.AddScoped<ISettingsService, SettingsService>();
        
        
        // ===== RELATIONSHIPSERVICES =====
        
        
        // ===== MESSAGE SERVICES =====
        services.AddScoped<ISendMessageService, SendMessageService>();
        services.AddScoped<IMessageQueryService, MessageQueryService>();
        services.AddScoped<IReactionService, ReactionService>();
        
        // ===== CONVERSATION SERVICES =====
        services.AddScoped<IGetConversationsService, GetConversationsService>(); // ✅
        services.AddScoped<IDirectConversationService, DirectConversationService>(); // ✅
        services.AddScoped<IGroupConversationService, GroupConversationService>(); // ✅
        services.AddScoped<IArchiveConversationService, ArchiveConversationService>(); // ✅
        services.AddScoped<ISearchConversationsService, SearchConversationsService>(); // ✅
        
        services.AddScoped<IGroupConversationBroadcastService, GroupConversationBroadcastService>(); // ✅
        
        // ===== LOCALICATION AND GEOGRAPHY SERVICES =====
        services.AddSingleton<ICountryService, CountryService>();
        
        // ===== NOTIFICATION SERVICES =====
        services.AddScoped<INotificationService, NotificationService>();
        
        
         
        
        // ===== MESSAGE NOTIFICATION SERVICES =====
        services.AddScoped<IGroupNotificationService, GroupNotificationService>();
        services.AddScoped<IGroupNotificationService, GroupNotificationService>();
        services.AddScoped<IMessageNotificationQueryService, MessageNotificationQueryService>();
        services.AddScoped<IMessageNotificationStateService, MessageNotificationStateService>();
        
        
        // ===== BROADCAST SERVICES =====
        services.AddScoped<IMessageNotificationService, MessageNotificationService>();
        services.AddScoped<ISyncService, SyncService>();
        
        services.AddScoped<IMessageBroadcastService, MessageBroadcastService>(); 
        services.AddScoped<IConversationBroadcastService, ConversationBroadcastService>();
        services.AddScoped<IProfileBroadcastService, ProfileBroadcastService>();
        
        
        
        
        // ===== FILES =====
        services.AddScoped<IFileService, FileService>();
        
        
        // ===== VALIDATORS =====
        services.AddScoped<ISendMessageValidator, SendMessageValidator>();
        services.AddScoped<IGroupInviteValidator, GroupInviteValidator>();
        services.AddScoped<IConversationValidator, ConversationValidator>();
        services.AddScoped<IFileValidator, FileValidator>();
   
        // ===== Orchestrators =====
        services.AddScoped<IFileOrchestrator, FileOrchestrator>();
        


        
        // Til refaktorering
        services.AddScoped<GroupNotificationService>();
        services.AddScoped<BootstrapService>();
        services.AddScoped<FriendService>();
        services.AddScoped<UserOnlineService>();
        services.AddScoped<SupportService>();
        services.AddScoped<E2EEService>();
        services.AddScoped<IBlockingService, BlockingService>();
        

        return services;
    }
}
