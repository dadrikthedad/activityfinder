using AFBack.Common.Enum;
using AFBack.Common.Results;
using AFBack.Configurations.Options;
using AFBack.Features.FileHandling.Enums;
using Azure;
using Azure.Storage.Blobs;
using Azure.Storage.Blobs.Models;
using Azure.Storage.Sas;

namespace AFBack.Features.FileHandling.Services;

public class AzureBlobStorageService(
    BlobServiceClient blobServiceClient,
    IConfiguration configuration,
    ILogger<AzureBlobStorageService> logger,
    IBlobUrlBuilder blobUrlBuilder) : IStorageService
{
    private readonly string _containerName = configuration["Azure:BlobContainerName"]
                                             ?? throw new InvalidOperationException(
                                                 "Azure:BlobContainerName not configured");

    /// <inheritdoc />
    public async Task<Result<string>> UploadAsync(Stream? stream, string storageKey, string contentType,
        BlobContainer container, Dictionary<string, string>? metadata = null, CancellationToken ct = default)
    {
        // Validerer stream først
        if (stream is null || !stream.CanRead)
        {
            logger.LogError("Invalid stream provided for upload: {Key}", storageKey);
            return Result<string>.Failure("Invalid file stream");
        }

        // Network streams så fungerer ikke alltid Length, derfor sjekker vi med CanSeek også
        if (stream.CanSeek && stream.Length == 0)
        {
            logger.LogError("Empty stream provided for upload: {Key}", storageKey);
            return Result<string>.Failure("File is empty");
        }

        try
        {
            // Henter klienten med vår fil som referanse
            var blobClient = GetBlobClient(storageKey, container);

            // Setter content type og metadata på bloben - "application/octet-stream" hvis kryptert
            var options = new BlobUploadOptions
            {
                HttpHeaders = new BlobHttpHeaders
                {
                    ContentType = contentType
                },
                Metadata = metadata
            };
            
            // Laster opp filen
            await blobClient.UploadAsync(stream, options, ct);

            logger.LogInformation("Successfully uploaded file to Azure Blob: {Key}", storageKey);

            return Result<string>.Success(blobClient.Uri.ToString());
        }
        catch (RequestFailedException ex)
        {
            logger.LogError(ex, "Azure Blob error uploading file: {Key}. Status: {Status}",
                storageKey, ex.Status);
            return Result<string>.Failure($"Failed to upload file: {ex.Message}", 
                ErrorTypeEnum.InternalServerError);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Unexpected error uploading file to Azure Blob: {Key}", storageKey);
            return Result<string>.Failure("An unexpected error occurred while uploading the file", 
                ErrorTypeEnum.InternalServerError);
        }
    }

    /// <inheritdoc />
    public async Task<Result<Stream>> DownloadAsync(string storageKey, BlobContainer container,
        CancellationToken ct = default)
    {
        try
        {
            // Oppretter en peker på filen/stien
            var blobClient = GetBlobClient(storageKey, container);
            
            var response = await blobClient.DownloadStreamingAsync(cancellationToken: ct);

            // Sjekker at filen ikke er tom
            if (response.Value.Details.ContentLength == 0)
            {
                logger.LogWarning("Empty file downloaded from Azure Blob: {Key}", storageKey);
                return Result<Stream>.Failure("File is empty");
            }

            logger.LogInformation("Successfully downloaded file from Azure Blob: {Key}", storageKey);

            return Result<Stream>.Success(response.Value.Content);
        }
        catch (RequestFailedException ex) when (ex.Status == 404)
        {
            logger.LogWarning("File not found in Azure Blob: {Key}", storageKey);
            return Result<Stream>.Failure("File not found", ErrorTypeEnum.NotFound);
        }
        catch (RequestFailedException ex)
        {
            logger.LogError(ex, "Azure Blob error downloading file: {Key}. Status: {Status}",
                storageKey, ex.Status);
            return Result<Stream>.Failure($"Failed to download file: {ex.Message}");
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Unexpected error downloading file from Azure Blob: {Key}", storageKey);
            return Result<Stream>.Failure("An unexpected error occurred while downloading the file");
        }
    }

    /// <inheritdoc />
    public async Task<Result<string>> GenerateDownloadUrlAsync(string storageKey, BlobContainer container,
        CancellationToken ct = default)
    {
        try
        {
            var blobClient = GetBlobClient(storageKey, container);

            // Sjekker at bloben faktisk finnes før vi genererer URL
            var exists = await blobClient.ExistsAsync(ct);
            if (!exists.Value)
            {
                logger.LogWarning("Cannot generate SAS URL — file not found: {Key}", storageKey);
                return Result<string>.Failure("File not found", ErrorTypeEnum.NotFound);
            }

            // Oppretter en User Delegation Key for sikker SAS-generering
            // User Delegation SAS er sikrere enn Account Key SAS fordi den:
            // 1. Bruker Azure AD-identitet istedenfor lagringsnøkkel
            // 2. Kan revokeres uavhengig
            // 3. Har kortere levetid
            
            // Hvor lenge SAS - den signerte URLen skal leve
            var sasExpiry = TimeSpan.FromMinutes(FileConfig.SasExpiryMinutes);
            
            // Klokkeslettet signeringsnøkkelen for URL-en er gyldig ifra
            var delegationKeyStart = DateTimeOffset.UtcNow.AddMinutes(
                FileConfig.DelegationKeyDelayMinutes);
            // Klokkeslettet signeringsnøkkelen er gyldig til (samme som URLen)
            var delegationKeyExpiry = DateTimeOffset.UtcNow.Add(sasExpiry);

            // Vi ber Azure om en midlertidig signeringsnøkkel via vår Managed Identity
            var userDelegationResponse = await blobServiceClient.GetUserDelegationKeyAsync(
                delegationKeyStart, delegationKeyExpiry, ct);

            // Definerer reglene for SAS URL-en — kun les, kun HTTPS, kun denne filen
            var sasBuilder = new BlobSasBuilder
            {
                BlobContainerName = _containerName,
                BlobName = storageKey,
                Resource = "b",                    // b = blob (enkeltfil)
                StartsOn = delegationKeyStart,
                ExpiresOn = delegationKeyExpiry,
                Protocol = SasProtocol.Https
            };

            // Kun lesetilgang
            sasBuilder.SetPermissions(BlobSasPermissions.Read);

            // Signerer URL-en med delegation key
            var sasToken = sasBuilder.ToSasQueryParameters(userDelegationResponse.Value, 
                blobServiceClient.AccountName);

            return Result<string>.Success($"{blobClient.Uri}?{sasToken}");
        }
        catch (RequestFailedException ex)
        {
            logger.LogError(ex, "Azure Blob error generating SAS URL: {Key}. Status: {Status}",
                storageKey, ex.Status);
            return Result<string>.Failure($"Failed to generate download URL: {ex.Message}");
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Unexpected error generating SAS URL: {Key}", storageKey);
            return Result<string>.Failure("An unexpected error occurred while generating the download URL");
        }
    }

    /// <inheritdoc />
    public async Task<Result> DeleteAsync(string storageKey, BlobContainer container,
        CancellationToken ct = default)
    {
        try
        {
            var blobClient = GetBlobClient(storageKey, container);

            // DeleteIfExistsAsync returnerer true/false, men vi bryr oss ikke —
            // sletting av noe som ikke finnes er ikke en feil i vår kontekst
            var deleteResponse = await blobClient.DeleteIfExistsAsync(
                DeleteSnapshotsOption.IncludeSnapshots, cancellationToken: ct);
            
            if (!deleteResponse)
                logger.LogDebug("File did not exist in Azure Blob, nothing to delete: {Key}", storageKey);
            else
                logger.LogInformation("Successfully deleted file from Azure Blob: {Key}", storageKey);

            return Result.Success();
        }
        catch (RequestFailedException ex)
        {
            logger.LogError(ex, "Azure Blob error deleting file: {Key}. Status: {Status}",
                storageKey, ex.Status);
            return Result.Failure($"Failed to delete file: {ex.Message}");
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Unexpected error deleting file from Azure Blob: {Key}", storageKey);
            return Result.Failure("An unexpected error occurred while deleting the file");
        }
    }

    /// <inheritdoc />
    public async Task<Result<bool>> ExistsAsync(string storageKey, BlobContainer container,
        CancellationToken ct = default)
    {
        try
        {
            var blobClient = GetBlobClient(storageKey, container);

            var exists = await blobClient.ExistsAsync(ct);

            return Result<bool>.Success(exists.Value);
        }
        catch (RequestFailedException ex)
        {
            logger.LogError(ex, "Azure Blob error checking file existence: {Key}. Status: {Status}",
                storageKey, ex.Status);
            return Result<bool>.Failure($"Failed to check file existence: {ex.Message}");
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Unexpected error checking file existence in Azure Blob: {Key}", storageKey);
            return Result<bool>.Failure("An unexpected error occurred while checking file existence");
        }
    }
    
    // ===================== Private hjelpemetoder =====================
    

    /// <summary>
    /// Setter opp en referanse med BlobClient for en gitt storage key. Denne klienten peker på filen
    /// </summary>
    /// <param name="storageKey">Stien/navnet på filen i containeren</param>
    /// <param name="container">Ønsket container</param>
    /// <returns>En BlobClient som peker på den angitte filen i containeren</returns>
    private BlobClient GetBlobClient(string storageKey, BlobContainer container)
    {
        // Henter ut ønsket container vi ønsker filen lastet opp til
        var containerName = blobUrlBuilder.GetContainerName(container);
        // Oppretter en klient for ønsket container
        var containerClient = blobServiceClient.GetBlobContainerClient(containerName);
        // Oppretter en referanse i containeren i Blob Storage-en med filen vår
        return containerClient.GetBlobClient(storageKey);
    }
    
}
