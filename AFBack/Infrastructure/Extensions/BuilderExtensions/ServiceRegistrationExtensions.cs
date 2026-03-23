using AFBack.Features.Account.Services;
using AFBack.Features.Auth.Repositories;
using AFBack.Features.Auth.Services;
using AFBack.Features.Auth.Services.Interfaces;
using AFBack.Features.Blocking.Repository;
using AFBack.Features.Blocking.Services;
using AFBack.Features.Broadcast.Services;
using AFBack.Features.Broadcast.Services.Interfaces;
using AFBack.Features.CanSend.Repository;
using AFBack.Features.Conversation.Repository;
using AFBack.Features.Conversation.Services;
using AFBack.Features.Conversation.Validators;
using AFBack.Features.FileHandling.Services;
using AFBack.Features.FileHandling.Validators;
using AFBack.Features.Geography.Services;
using AFBack.Features.MessageNotifications.Repository;
using AFBack.Features.MessageNotifications.Service;
using AFBack.Features.Messaging.Repository;
using AFBack.Features.Messaging.Services;
using AFBack.Features.Messaging.Validators;
using AFBack.Features.Profile.Repository;
using AFBack.Features.Profile.Services;
using AFBack.Features.Reactions.Repositories;
using AFBack.Features.Reactions.Services;
using AFBack.Features.Settings.Repositories;
using AFBack.Features.Settings.Services;
using AFBack.Features.SignalR.Repository;
using AFBack.Features.Support.Repositories;
using AFBack.Features.Support.Services;
using AFBack.Features.SyncEvents.Repository;
using AFBack.Features.SyncEvents.Services;
using AFBack.Infrastructure.Security.Repositories;

namespace AFBack.Infrastructure.Extensions.BuilderExtensions;

public static class ServiceRegistrationExtensions
{
    /// <summary>
    /// Legger til repositories
    /// </summary>
    public static IServiceCollection AddRepositories(this IServiceCollection services)
    {
        // ===== AUTHENTICATION REPOSITORIES =====
        services.AddScoped<IUserRepository, UserRepository>();
        services.AddScoped<IUserDeviceRepository, UserDeviceRepository>();
        services.AddScoped<ILoginHistoryRepository, LoginHistoryRepository>();
        services.AddScoped<IVerificationInfoRepository, VerificationInfoRepository>();
        
        // =====  USER =====
        services.AddScoped<IProfileRepository, ProfileRepository>();
        services.AddScoped<ISettingsRepository, SettingsRepository>();
        
        // ===== TOKEN  =====
        services.AddScoped<IRefreshTokenRepository, RefreshTokenRepository>();
        
        // ===== SECURITY =====
        services.AddScoped<IIpBanRepository, IpBanRepository>();
        services.AddScoped<ISuspiciousActivityRepository, SuspiciousActivityRepository>();
        
        // ===== RELATIONSHIPSERVICES =====
        services.AddScoped<IUserBlockRepository, UserBlockRepository>();
        
        // ===== MESSAGE =====
        services.AddScoped<ICanSendRepository, CanSendRepository>();
        services.AddScoped<IMessageRepository, MessageRepository>();
        services.AddScoped<IReactionRepository, ReactionRepository>();
        services.AddScoped<IUserPublicKeyRepository, UserPublicKeyRepository>();
        
        // ===== CONVERSATION =====
        services.AddScoped<IConversationRepository, ConversationRepository>();
        services.AddScoped<IConversationLeftRecordRepository, ConversationLeftRecordRepository>();
        
        // ===== BROADCAST =====
        services.AddScoped<ISyncEventRepository, SyncEventRepository>();
        services.AddScoped<IDeviceSyncStateRepository, DeviceSyncStateRepository>();
        
        // ===== MESSAGE NOTIFICATION =====
        services.AddScoped<IMessageNotificationRepository, MessageNotificationRepository>();
        
        // ===== SUPPORT =====
        services.AddScoped<ISupportRepository, SupportRepository>();
        
        // ===== SIGNALR =====
        services.AddScoped<IUserConnectionRepository, UserConnectionRepository>();
        
        return services;
    }
    
    /// <summary>
    /// Legger til forretningslogikk-servicer
    /// </summary>
    public static IServiceCollection AddBusinessServices(this IServiceCollection services)
    {
        // ===== AUTHENTICATION SERVICES =====
        services.AddScoped<IAuthService, AuthService>();
        services.AddScoped<IVerificationInfoService, VerificationInfoService>();
        services.AddScoped<IUserDeviceService, UserDeviceService>();
        services.AddScoped<ILoginHistoryService, LoginHistoryService>();
        services.AddScoped<IAccountVerificationService, AccountVerificationService>();
        services.AddScoped<IPasswordService, PasswordService>();
        
        // =====  USER SERVICES =====
        services.AddScoped<IAccountChangeService, AccountChangeService>();
        services.AddScoped<IProfileService, ProfileService>();
        services.AddScoped<ISettingsService, SettingsService>();
        
        // ===== TOKEN =====
        services.AddScoped<ITokenService, TokenService>();
        
        // ===== RELATIONSHIPSERVICES =====
        services.AddScoped<IBlockingService, BlockingService>();
        
        // ===== MESSAGE SERVICES =====
        services.AddScoped<ISendMessageService, SendMessageService>();
        services.AddScoped<IMessageQueryService, MessageQueryService>();
        services.AddScoped<IReactionService, ReactionService>();
        services.AddScoped<IEncryptionService, EncryptionService>();
        
        // ===== CONVERSATION SERVICES =====
        services.AddScoped<IGetConversationsService, GetConversationsService>(); 
        services.AddScoped<IDirectConversationService, DirectConversationService>();
        services.AddScoped<IGroupConversationService, GroupConversationService>(); 
        services.AddScoped<IArchiveConversationService, ArchiveConversationService>(); 
        services.AddScoped<ISearchConversationsService, SearchConversationsService>(); 
        
        // ===== BROADCAST SERVICES =====
        services.AddScoped<ISyncService, SyncService>();
        services.AddScoped<IMessageBroadcastService, MessageBroadcastService>(); 
        services.AddScoped<IConversationBroadcastService, ConversationBroadcastService>();
        services.AddScoped<IProfileBroadcastService, ProfileBroadcastService>();
        services.AddScoped<IGroupConversationBroadcastService, GroupConversationBroadcastService>(); 
        services.AddScoped<IReactionBroadcastService, ReactionBroadcastService>();
        
        // ===== LOCALICATION AND GEOGRAPHY SERVICES =====
        services.AddHttpClient<IGeoLocationService>(client =>
        {
            client.BaseAddress = new Uri("https://ipwho.is/");
            client.Timeout = TimeSpan.FromSeconds(5);
        });
        services.AddSingleton<ICountryService, CountryService>();
        services.AddSingleton<IGeoLocationService, GeolocationService>();
        
        // ===== MESSAGE NOTIFICATION SERVICES =====
        services.AddScoped<IMessageNotificationService, MessageNotificationService>();
        services.AddScoped<IGroupNotificationService, GroupNotificationService>();
        services.AddScoped<IMessageNotificationQueryService, MessageNotificationQueryService>();
        services.AddScoped<IMessageNotificationStateService, MessageNotificationStateService>();
        
        // ===== SUPPORT SERVICES =====
        services.AddScoped<ISupportTicketService, SupportTicketService>();
        services.AddScoped<IUserReportService, UserReportService>();
        
        // ===== VALIDATORS =====
        services.AddScoped<ISendMessageValidator, SendMessageValidator>();
        services.AddScoped<IGroupInviteValidator, GroupInviteValidator>();
        services.AddScoped<IConversationValidator, ConversationValidator>();
        services.AddScoped<IFileValidator, FileValidator>();
   
        // ===== Orchestrators =====
        services.AddScoped<IFileOrchestrator, FileOrchestrator>();
        
        
        return services;
    }
}
