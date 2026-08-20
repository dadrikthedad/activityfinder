using AFBack.Common.Results;
using AFBack.Features.Auth.DTOs.Request;
using AFBack.Features.Auth.DTOs.Response;
using AFBack.Features.Dev.DTOs;

namespace AFBack.Features.Dev.Services;

public interface IDevService
{
    Task<Result<LoginResponse>> DevLoginAsync(VerifyMfaRequest request, string ipAddress,
        string? userAgent, CancellationToken ct = default);

    Task<Result<List<DevUserDto>>> GetUsersAsync();
}
