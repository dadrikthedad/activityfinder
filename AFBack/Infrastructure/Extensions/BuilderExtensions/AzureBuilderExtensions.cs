using AFBack.Features.FileHandling.Services;
using AFBack.Infrastructure.Email;
using AFBack.Infrastructure.KeyVault.Services;
using AFBack.Infrastructure.Sms.Services;
using Azure.Communication.Email;
using Azure.Communication.Sms;
using Azure.Identity;
using Azure.Security.KeyVault.Secrets;
using Azure.Storage.Blobs;
using Serilog;

namespace AFBack.Infrastructure.Extensions.BuilderExtensions;

public static class AzureBuilderExtensions
{
    /// <summary>
    /// Setter opp Secrets med Azure KeyVault
    /// Lokalt brukes dotnet user-secrets automatisk via CreateBuilder()
    /// </summary>
    public static void ConfigureSecrets(this WebApplicationBuilder builder)
    {
        if (builder.Environment.IsDevelopment())
            return;
        
        if (builder.Environment.IsProduction())
        {
            var keyVaultUrl = builder.Configuration["KeyVault:Url"]
                              ?? throw new InvalidOperationException("KeyVault:Url is not configured");

            builder.Configuration.AddAzureKeyVault(
                new Uri(keyVaultUrl),
                new DefaultAzureCredential());
        }
    }
    
    /// <summary>
    /// Setter opp Azure Application Innsights med serilog
    /// </summary>
    public static void ConfigureAzureMonitoring(this WebApplicationBuilder builder)
    {
        if (builder.Environment.IsDevelopment())
            return;
        
        var connectionString = builder.Configuration["Monitoring:ApplicationInsightsConnectionString"]
                               ?? throw new InvalidOperationException(
                                   "Monitoring:ApplicationInsightsConnectionString is not configured");
        
        // Serilog sinker til App Insights
        builder.Host.UseSerilog((_, config) =>
        {
            config.WriteTo.ApplicationInsights(connectionString, TelemetryConverter.Traces);
        });
        
        // Application Insights telemetri (dependency tracking, performance metrics)
        builder.Services.AddApplicationInsightsTelemetry(options =>
        {
            options.ConnectionString = connectionString;
            options.EnableAdaptiveSampling = true;
            options.EnableDependencyTrackingTelemetryModule = true;
            options.EnablePerformanceCounterCollectionModule = true;
        });
    }
    
    /// <summary>
    /// KeyVault runtime-tilgang for lagring av brukersecrets
    /// </summary>
    public static IServiceCollection AddAzureKeyVault(this IServiceCollection services, IConfiguration configuration)
    {
        var keyVaultUrl = configuration["KeyVault:Url"]
                          ?? throw new InvalidOperationException("KeyVault:Url is not configured");

        services.AddSingleton(new SecretClient(new Uri(keyVaultUrl), new DefaultAzureCredential()));
        services.AddScoped<IKeyVaultService, KeyVaultService>();

        return services;
    }

    /// <summary>
    /// Azure Blob Storage for filhåndtering
    /// </summary>
    public static IServiceCollection AddAzureBlobStorage(this IServiceCollection services, IConfiguration configuration)
    {
        var blobAccountUrl = configuration["Storage:BlobAccountUrl"]
                             ?? throw new InvalidOperationException("Storage:BlobAccountUrl is not configured");

        services.AddSingleton(new BlobServiceClient(new Uri(blobAccountUrl), new DefaultAzureCredential()));
        services.AddScoped<IStorageService, AzureBlobStorageService>();
        services.AddSingleton<IBlobUrlBuilder, BlobUrlBuilder>();

        return services;
    }

    /// <summary>
    /// Azure Communication Services for e-post
    /// </summary>
    public static IServiceCollection AddAzureEmail(this IServiceCollection services, IConfiguration configuration)
    {
        var connectionString = configuration["Email:ConnectionString"]
                               ?? throw new InvalidOperationException("Email:ConnectionString is not configured");

        services.AddSingleton(new EmailClient(connectionString));
        services.AddScoped<IEmailService, EmailService>();

        return services;
    }

    /// <summary>
    /// Azure Communication Services for SMS
    /// </summary>
    public static IServiceCollection AddAzureSms(this IServiceCollection services, IConfiguration configuration)
    {
        var connectionString = configuration["Sms:ConnectionString"]
                               ?? throw new InvalidOperationException("Sms:ConnectionString is not configured");

        services.AddSingleton(new SmsClient(connectionString));
        services.AddScoped<ISmsService, SmsService>();

        return services;
    }
}
