using AFBack.Common.Enum;
using AFBack.Common.Results;
using AFBack.Configurations.Options;
using AFBack.Features.FileHandling.Enums;
using Amazon.S3;
using Amazon.S3.Model;

namespace AFBack.Features.FileHandling.Services;

public class S3StorageService(
    IAmazonS3 s3Client,
    ILogger<S3StorageService> logger,
    IBlobUrlBuilder blobUrlBuilder) : IStorageService
{
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
            // Henter bucket-navnet
            var bucketName = blobUrlBuilder.GetContainerName(container);

            // Setter content type og metadata på bloben - "application/octet-stream" hvis kryptert
            var request = new PutObjectRequest
            {
                BucketName = bucketName,
                Key = storageKey,
                InputStream = stream,
                ContentType = contentType,
                AutoCloseStream = false
            };
            
            // Metadata
            if (metadata != null)
                foreach (var (key, value) in metadata)
                    request.Metadata[key] = value;
            
            // Laster opp filen
            await s3Client.PutObjectAsync(request, ct);
            
            var url = blobUrlBuilder.GetBlobUrl(storageKey, container);

            logger.LogInformation("Successfully uploaded file to S3: {Key}", storageKey);

            return Result<string>.Success(url);
        }
        catch (AmazonS3Exception ex)
        {
            logger.LogError(ex, "S3 error uploading file: {Key}. Status: {Status}", storageKey, ex.StatusCode);
            return Result<string>.Failure($"Failed to upload file: {ex.Message}",
                AppErrorCode.InternalServerError);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Unexpected error uploading file to S3: {Key}", storageKey);
            return Result<string>.Failure("An unexpected error occurred while uploading the file", 
                AppErrorCode.InternalServerError);
        }
    }

    /// <inheritdoc />
    public async Task<Result<Stream>> DownloadAsync(string storageKey, BlobContainer container,
        CancellationToken ct = default)
    {
        try
        {
            // Oppretter en peker på filen/stien
            var bucketName = blobUrlBuilder.GetContainerName(container);
            
            var response = await s3Client.GetObjectAsync(bucketName, storageKey, ct);

            // Sjekker at filen ikke er tom
            if (response.ContentLength == 0)
            {
                logger.LogWarning("Empty file downloaded from S3: {Key}", storageKey);
                return Result<Stream>.Failure("File is empty");
            }

            logger.LogInformation("Successfully downloaded file from S3: {Key}", storageKey);

            return Result<Stream>.Success(response.ResponseStream);
        }
        catch (AmazonS3Exception ex) when (ex.StatusCode == System.Net.HttpStatusCode.NotFound)
        {
            logger.LogWarning("File not found in S3: {Key}", storageKey);
            return Result<Stream>.Failure("File not found", AppErrorCode.NotFound);
        }
        catch (AmazonS3Exception  ex)
        {
            logger.LogError(ex, "S3 error downloading file: {Key}. Status: {Status}", 
                storageKey, ex.StatusCode);
            return Result<Stream>.Failure($"Failed to download file: {ex.Message}");
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Unexpected error downloading file from S3: {Key}", storageKey);
            return Result<Stream>.Failure("An unexpected error occurred while downloading the file");
        }
    }

    /// <inheritdoc />
    public async Task<Result<string>> GenerateDownloadUrlAsync(string storageKey, BlobContainer container,
        CancellationToken ct = default)
    {
        try
        {
            var bucketName = blobUrlBuilder.GetContainerName(container);

            // En tidsbegrenset URL kun for denne filen
            var request = new GetPreSignedUrlRequest
            {
                BucketName = bucketName,
                Key        = storageKey,
                Verb       = HttpVerb.GET,
                Expires    = DateTime.UtcNow.AddMinutes(FileConfig.SasExpiryMinutes),
                Protocol   = Protocol.HTTPS
            };

            // Få en SAS URL-lenke
            var url = await s3Client.GetPreSignedURLAsync(request);

            logger.LogInformation("Successfully generated presigned URL for S3: {Key}", storageKey);

            return Result<string>.Success(url);
        }
        catch (AmazonS3Exception ex)
        {
            logger.LogError(ex, "S3 error generating presigned URL: {Key}. Status: {Status}",
                storageKey, ex.StatusCode);
            return Result<string>.Failure($"Failed to generate download URL: {ex.Message}");
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Unexpected error generating presigned URL: {Key}", storageKey);
            return Result<string>.Failure("An unexpected error occurred while generating the download URL");
        }
    }

    /// <inheritdoc />
    public async Task<Result> DeleteAsync(string storageKey, BlobContainer container,
        CancellationToken ct = default)
    {
        try
        {
            var bucketName = blobUrlBuilder.GetContainerName(container);

            await s3Client.DeleteObjectAsync(bucketName, storageKey, ct);

            logger.LogInformation("Successfully deleted file from S3: {Key}", storageKey);

            return Result.Success();
        }
        catch (AmazonS3Exception ex)
        {
            logger.LogError(ex, "S3 error deleting file: {Key}. Status: {Status}", storageKey, ex.StatusCode);
            return Result.Failure($"Failed to delete file: {ex.Message}");
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Unexpected error deleting file from S3: {Key}", storageKey);
            return Result.Failure("An unexpected error occurred while deleting the file");
        }
    }

    /// <inheritdoc />
    public async Task<Result<bool>> ExistsAsync(string storageKey, BlobContainer container,
        CancellationToken ct = default)
    {
        try
        {
            var bucketName = blobUrlBuilder.GetContainerName(container);

            await s3Client.GetObjectMetadataAsync(bucketName, storageKey, ct);

            return Result<bool>.Success(true);
        }
        catch (AmazonS3Exception ex) when (ex.StatusCode == System.Net.HttpStatusCode.NotFound)
        {
            return Result<bool>.Success(false);
        }
        catch (AmazonS3Exception ex)
        {
            logger.LogError(ex, "S3 error checking file existence: {Key}. Status: {Status}",
                storageKey, ex.StatusCode);
            return Result<bool>.Failure($"Failed to check file existence: {ex.Message}");
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Unexpected error checking file existence in S3: {Key}", storageKey);
            return Result<bool>.Failure("An unexpected error occurred while checking file existence");
        }
    }
    
}
