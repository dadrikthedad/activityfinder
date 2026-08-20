using AFBack.Common.Enum;
using AFBack.Common.Results;
using AFBack.Configurations.Options;
using AFBack.Features.FileHandling.Enums;
using Minio;
using Minio.DataModel.Args;
using Minio.Exceptions;

namespace AFBack.Features.FileHandling.Services;

public class S3StorageService(
    IMinioClient s3Client,
    ILogger<S3StorageService> logger,
    IBlobUrlBuilder blobUrlBuilder) : IStorageService
{
    /// <inheritdoc />
    public async Task<Result<string>> UploadAsync(Stream? stream, string storageKey, string contentType,
        BlobContainer container, Dictionary<string, string>? metadata = null, CancellationToken ct = default)
    {
        if (stream is null || !stream.CanRead)
        {
            logger.LogError("Invalid stream provided for upload: {Key}", storageKey);
            return Result<string>.Failure("Invalid file stream", AppErrorCode.InternalError);
        }

        try
        {
            var bucketName = blobUrlBuilder.GetContainerName(container);

            // Minio krever kjent størrelse — buffer til MemoryStream hvis stream ikke er søkbar
            Stream uploadStream = stream;
            long streamSize;

            if (stream.CanSeek)
            {
                streamSize = stream.Length - stream.Position;
            }
            else
            {
                var buffer = new MemoryStream();
                await stream.CopyToAsync(buffer, ct);
                buffer.Position = 0;
                uploadStream = buffer;
                streamSize = buffer.Length;
            }

            if (streamSize == 0)
            {
                logger.LogError("Empty stream provided for upload: {Key}", storageKey);
                return Result<string>.Failure("File is empty", AppErrorCode.InternalError);
            }

            var args = new PutObjectArgs()
                .WithBucket(bucketName)
                .WithObject(storageKey)
                .WithStreamData(uploadStream)
                .WithObjectSize(streamSize)
                .WithContentType(contentType);

            if (metadata != null)
                args = args.WithHeaders(metadata);

            await s3Client.PutObjectAsync(args, ct);

            var url = blobUrlBuilder.GetBlobUrl(storageKey, container);
            logger.LogInformation("Successfully uploaded file to S3: {Key}", storageKey);
            return Result<string>.Success(url);
        }
        catch (MinioException ex)
        {
            logger.LogError(ex, "S3 error uploading file: {Key}", storageKey);
            return Result<string>.Failure($"Failed to upload file: {ex.Message}", AppErrorCode.InternalError);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Unexpected error uploading file to S3: {Key}", storageKey);
            return Result<string>.Failure("An unexpected error occurred while uploading the file", AppErrorCode.InternalError);
        }
    }

    /// <inheritdoc />
    public async Task<Result<Stream>> DownloadAsync(string storageKey, BlobContainer container,
        CancellationToken ct = default)
    {
        try
        {
            var bucketName = blobUrlBuilder.GetContainerName(container);
            var output = new MemoryStream();

            var args = new GetObjectArgs()
                .WithBucket(bucketName)
                .WithObject(storageKey)
                .WithCallbackStream(async (s, token) =>
                {
                    await s.CopyToAsync(output, token);
                });

            await s3Client.GetObjectAsync(args, ct);
            output.Position = 0;

            if (output.Length == 0)
            {
                logger.LogWarning("Empty file downloaded from S3: {Key}", storageKey);
                return Result<Stream>.Failure("File is empty", AppErrorCode.InternalError);
            }

            logger.LogInformation("Successfully downloaded file from S3: {Key}", storageKey);
            return Result<Stream>.Success(output);
        }
        catch (ObjectNotFoundException)
        {
            logger.LogWarning("File not found in S3: {Key}", storageKey);
            return Result<Stream>.Failure("File not found", AppErrorCode.NotFound);
        }
        catch (MinioException ex)
        {
            logger.LogError(ex, "S3 error downloading file: {Key}", storageKey);
            return Result<Stream>.Failure($"Failed to download file: {ex.Message}", AppErrorCode.InternalError);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Unexpected error downloading file from S3: {Key}", storageKey);
            return Result<Stream>.Failure("An unexpected error occurred while downloading the file", AppErrorCode.InternalError);
        }
    }

    /// <inheritdoc />
    public async Task<Result<string>> GenerateDownloadUrlAsync(string storageKey, BlobContainer container,
        CancellationToken ct = default)
    {
        try
        {
            var bucketName = blobUrlBuilder.GetContainerName(container);

            var args = new PresignedGetObjectArgs()
                .WithBucket(bucketName)
                .WithObject(storageKey)
                .WithExpiry(FileConfig.SasExpiryMinutes * 60);

            var url = await s3Client.PresignedGetObjectAsync(args);
            logger.LogInformation("Successfully generated presigned URL for S3: {Key}", storageKey);
            return Result<string>.Success(url);
        }
        catch (MinioException ex)
        {
            logger.LogError(ex, "S3 error generating presigned URL: {Key}", storageKey);
            return Result<string>.Failure($"Failed to generate download URL: {ex.Message}", AppErrorCode.InternalError);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Unexpected error generating presigned URL: {Key}", storageKey);
            return Result<string>.Failure("An unexpected error occurred while generating the download URL", AppErrorCode.InternalError);
        }
    }

    /// <inheritdoc />
    public async Task<Result> DeleteAsync(string storageKey, BlobContainer container,
        CancellationToken ct = default)
    {
        try
        {
            var bucketName = blobUrlBuilder.GetContainerName(container);

            var args = new RemoveObjectArgs()
                .WithBucket(bucketName)
                .WithObject(storageKey);

            await s3Client.RemoveObjectAsync(args, ct);
            logger.LogInformation("Successfully deleted file from S3: {Key}", storageKey);
            return Result.Success();
        }
        catch (MinioException ex)
        {
            logger.LogError(ex, "S3 error deleting file: {Key}", storageKey);
            return Result.Failure($"Failed to delete file: {ex.Message}", AppErrorCode.InternalError);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Unexpected error deleting file from S3: {Key}", storageKey);
            return Result.Failure("An unexpected error occurred while deleting the file", AppErrorCode.InternalError);
        }
    }

    /// <inheritdoc />
    public async Task<Result<bool>> ExistsAsync(string storageKey, BlobContainer container,
        CancellationToken ct = default)
    {
        try
        {
            var bucketName = blobUrlBuilder.GetContainerName(container);

            var args = new StatObjectArgs()
                .WithBucket(bucketName)
                .WithObject(storageKey);

            await s3Client.StatObjectAsync(args, ct);
            return Result<bool>.Success(true);
        }
        catch (ObjectNotFoundException)
        {
            return Result<bool>.Success(false);
        }
        catch (MinioException ex)
        {
            logger.LogError(ex, "S3 error checking file existence: {Key}", storageKey);
            return Result<bool>.Failure($"Failed to check file existence: {ex.Message}", AppErrorCode.InternalError);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Unexpected error checking file existence in S3: {Key}", storageKey);
            return Result<bool>.Failure("An unexpected error occurred while checking file existence", AppErrorCode.InternalError);
        }
    }
}
