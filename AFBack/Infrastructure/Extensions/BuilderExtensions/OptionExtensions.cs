using AFBack.Configurations.Options;

namespace AFBack.Infrastructure.Extensions.BuilderExtensions;

/// <summary>
/// Register and validate the Option-classes for sections in AppSettings.
/// Lets us avoid magic strings and if something is missing we get an error at startup.
/// </summary>
public static class OptionExtensions
{
    public static IServiceCollection AddOptionExtensions(this IServiceCollection services, IConfiguration configuration,
        IWebHostEnvironment environment)
    {
        services.AddOptions<ConnectionStringOptions>()
            .Bind(configuration.GetSection(ConnectionStringOptions.SectionName))
            .ValidateDataAnnotations()
            .ValidateOnStart();

        services.AddOptions<AppOptions>()
            .Bind(configuration.GetSection(AppOptions.SectionName))
            .ValidateDataAnnotations()
            .ValidateOnStart();

        services.AddOptions<JwtSettings>()
            .Bind(configuration.GetSection(JwtSettings.SectionName))
            .ValidateDataAnnotations()
            .ValidateOnStart();

        services.AddOptions<CorsOptions>()
            .Bind(configuration.GetSection(CorsOptions.SectionName))
            .ValidateDataAnnotations()
            .ValidateOnStart();

        services.AddOptions<CacheOptions>()
            .Bind(configuration.GetSection(CacheOptions.SectionName))
            .ValidateDataAnnotations()
            .ValidateOnStart();

        services.AddOptions<StorageOptions>()
            .Bind(configuration.GetSection(StorageOptions.SectionName))
            .ValidateDataAnnotations()
            .ValidateOnStart();

        services.AddOptions<EmailOptions>()
            .Bind(configuration.GetSection(EmailOptions.SectionName))
            .ValidateDataAnnotations()
            .ValidateOnStart();

        services.AddOptions<SmsOptions>()
            .Bind(configuration.GetSection(SmsOptions.SectionName))
            .ValidateDataAnnotations()
            .ValidateOnStart();

        services.AddOptions<KeyVaultOptions>()
            .Bind(configuration.GetSection(KeyVaultOptions.SectionName))
            .ValidateDataAnnotations()
            .ValidateOnStart();

        services.AddOptions<MonitoringOptions>()
            .Bind(configuration.GetSection(MonitoringOptions.SectionName))
            .ValidateDataAnnotations()
            .ValidateOnStart();

        services.AddOptions<ProxyOptions>()
            .Bind(configuration.GetSection(ProxyOptions.SectionName))
            .ValidateDataAnnotations()
            .ValidateOnStart();

        return services;
    }
}
