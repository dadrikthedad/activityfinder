using System.Net.Http.Headers;
using AFBack.Features.FileHandling.Services;
using AFBack.Infrastructure.Email;
using AFBack.Infrastructure.KeyVault.Services;
using AFBack.Infrastructure.Sms.Services;
using Amazon.S3;

namespace AFBack.Infrastructure.Extensions.BuilderExtensions;

public static class UpCloudBuilderExtensions
{
    /// <summary>
    /// S3-kompatibel Object Storage på UpCloud
    /// </summary>
    public static IServiceCollection AddS3Storage(this IServiceCollection services, IConfiguration configuration)
    {
        var endpoint = configuration["Storage:BlobAccountUrl"]
                       ?? throw new InvalidOperationException("Storage:BlobAccountUrl is not configured");

        var accessKey = configuration["Storage:AccessKey"]
                        ?? throw new InvalidOperationException("Storage:AccessKey is not configured");

        var secretKey = configuration["Storage:SecretKey"]
                        ?? throw new InvalidOperationException("Storage:SecretKey is not configured");

        services.AddSingleton<IAmazonS3>(_ => new AmazonS3Client(
            accessKey,
            secretKey,
            new AmazonS3Config
            {
                ServiceURL    = endpoint,
                ForcePathStyle = true  // Påkrevd for ikke-AWS S3
            }
        ));

        services.AddScoped<IStorageService, S3StorageService>();
        services.AddSingleton<IBlobUrlBuilder, BlobUrlBuilder>();

        return services;
    }
    
    /// <summary>
    /// Brevo e-post via HTTP API
    /// </summary>
    public static IServiceCollection AddBrevoEmail(this IServiceCollection services, IConfiguration configuration)
    {
        var apiKey = configuration["Email:ApiKey"]
                     ?? throw new InvalidOperationException("Email:ApiKey is not configured");

        services.AddHttpClient<IEmailService, EmailService>(client =>
        {
            client.DefaultRequestHeaders.Add("api-key", apiKey);
            client.DefaultRequestHeaders.Accept.Add(
                new MediaTypeWithQualityHeaderValue("application/json"));
        });

        return services;
    }
    
    /// <summary>
    /// 46elks SMS via HTTP API
    /// </summary>
    public static IServiceCollection Add46ElksSms(this IServiceCollection services, IConfiguration configuration)
    {
        var username = configuration["Sms:ApiUsername"]
                       ?? throw new InvalidOperationException("Sms:ApiUsername is not configured");

        var password = configuration["Sms:ApiPassword"]
                       ?? throw new InvalidOperationException("Sms:ApiPassword is not configured");

        services.AddHttpClient<ISmsService, SmsService>(client =>
        {
            // Basic Auth — samme som curl -u username:password
            var credentials = Convert.ToBase64String(
                System.Text.Encoding.ASCII.GetBytes($"{username}:{password}"));
            client.DefaultRequestHeaders.Authorization =
                new AuthenticationHeaderValue("Basic", credentials);
        });

        return services;
    }
    
    /// <summary>
    /// HashiCorp Vault for lagring av recovery seeds
    /// </summary>
    public static IServiceCollection AddHashiCorpVault(this IServiceCollection services, IConfiguration configuration)
    {
        var vaultUrl = configuration["KeyVault:Url"]
                       ?? throw new InvalidOperationException("KeyVault:Url is not configured");

        var vaultToken = configuration["KeyVault:Token"]
                         ?? throw new InvalidOperationException("KeyVault:Token is not configured");

        services.AddHttpClient<IKeyVaultService, KeyVaultService>(client =>
            {
                // Setter url og token
                client.BaseAddress = new Uri(vaultUrl); 
                client.DefaultRequestHeaders.Add("X-Vault-Token", vaultToken);
            })
            .ConfigurePrimaryHttpMessageHandler(sp =>
            {
                var env = sp.GetRequiredService<IWebHostEnvironment>();

                // I dev ignorerer vi selvsignert sertifikat
                // I prod brukes et gyldig sertifikat (La oss kryptere / eget CA)
                if (env.IsDevelopment())
                {
                    return new HttpClientHandler
                    {
                        ServerCertificateCustomValidationCallback =
                            HttpClientHandler.DangerousAcceptAnyServerCertificateValidator
                    };
                }

                return new HttpClientHandler();
            });

        return services;
    }
}
