using System.Net.Http.Headers;
using AFBack.Configurations.Options;
using AFBack.Features.FileHandling.Services;
using AFBack.Infrastructure.Email;
using AFBack.Infrastructure.KeyVault.Services;
using AFBack.Infrastructure.Sms.Services;
using Microsoft.Extensions.Options;
using Minio;

namespace AFBack.Infrastructure.Extensions.BuilderExtensions;

public static class UpCloudBuilderExtensions
{
    /// <summary>
    /// S3-kompatibel Object Storage på UpCloud
    /// </summary>
    public static IServiceCollection AddS3Storage(this IServiceCollection services)
    {
        services.AddSingleton<IMinioClient>(sp =>
        {
            var options = sp.GetRequiredService<IOptions<StorageOptions>>().Value;
            var uri = new Uri(options.BlobAccountUrl);

            return new MinioClient()
                .WithEndpoint(uri.Host)
                .WithCredentials(options.AccessKey, options.SecretKey)
                .WithSSL(uri.Scheme == "https")
                .Build();
        });

        services.AddScoped<IStorageService, S3StorageService>();
        services.AddSingleton<IBlobUrlBuilder, BlobUrlBuilder>();

        return services;
    }

    /// <summary>
    /// Brevo e-post via HTTP API
    /// </summary>
    public static IServiceCollection AddBrevoEmail(this IServiceCollection services)
    {
        services.AddHttpClient<IEmailService, EmailService>((sp, client) =>
        {
            var options = sp.GetRequiredService<IOptions<EmailOptions>>().Value;
            client.DefaultRequestHeaders.Add("api-key", options.ApiKey);
            client.DefaultRequestHeaders.Accept.Add(
                new MediaTypeWithQualityHeaderValue("application/json"));
        });

        return services;
    }

    /// <summary>
    /// 46elks SMS via HTTP API
    /// </summary>
    public static IServiceCollection Add46ElksSms(this IServiceCollection services)
    {
        services.AddHttpClient<ISmsService, SmsService>((sp, client) =>
        {
            var options = sp.GetRequiredService<IOptions<SmsOptions>>().Value;
            var credentials = Convert.ToBase64String(
                System.Text.Encoding.ASCII.GetBytes($"{options.ApiUsername}:{options.ApiPassword}"));
            client.DefaultRequestHeaders.Authorization =
                new AuthenticationHeaderValue("Basic", credentials);
        });

        return services;
    }

    /// <summary>
    /// HashiCorp Vault for lagring av recovery seeds
    /// </summary>
    public static IServiceCollection AddHashiCorpVault(this IServiceCollection services)
    {
        services.AddHttpClient<IKeyVaultService, KeyVaultService>((sp, client) =>
            {
                var options = sp.GetRequiredService<IOptions<KeyVaultOptions>>().Value;
                client.BaseAddress = new Uri(options.Url);
                client.DefaultRequestHeaders.Add("X-Vault-Token", options.Token);
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
