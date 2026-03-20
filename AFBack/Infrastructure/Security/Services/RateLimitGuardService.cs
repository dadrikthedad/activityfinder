using AFBack.Common.Enum;
using AFBack.Common.Results;
using AFBack.Infrastructure.Email.Enums;
using AFBack.Infrastructure.Security.Enums;
using AFBack.Infrastructure.Sms.Enums;

namespace AFBack.Infrastructure.Security.Services;

public class RateLimitGuardService(
    IEmailRateLimitService emailRateLimitService,
    ISmsRateLimitService smsRateLimitService, 
    ISuspiciousActivityService suspiciousActivityService) : IRateLimitGuardService
{
    /// <inheritdoc/>
    public async Task<Result> CheckEmailRateLimitAsync(EmailType emailType, string email, string ipAddress)
    {
        var rateLimitResult = emailRateLimitService.CanSendEmail(emailType, email, ipAddress);
        if (rateLimitResult.IsSuccess)
            return Result.Success();

        await suspiciousActivityService.ReportSuspiciousActivityAsync(ipAddress, 
            SuspiciousActivityType.EmailRateLimitExceeded, $"{emailType} rate limit exceeded for {email}");

        return Result.Failure(rateLimitResult.Error, ErrorTypeEnum.TooManyRequests);
    }
    
    /// <inheritdoc/>
    public async Task<Result> CheckSmsRateLimitAsync(SmsType smsType, string phoneNumber, string ipAddress)
    {
        var rateLimitResult = smsRateLimitService.CanSendSms(smsType, phoneNumber, ipAddress);
        if (rateLimitResult.IsSuccess)
            return Result.Success();

        await suspiciousActivityService.ReportSuspiciousActivityAsync(ipAddress,
            SuspiciousActivityType.SmsRateLimitExceeded, $"{smsType} SMS rate limit exceeded for {phoneNumber}");

        return Result.Failure(rateLimitResult.Error, ErrorTypeEnum.TooManyRequests);
    }
}
