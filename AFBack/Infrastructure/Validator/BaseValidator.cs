

using AFBack.Features.Exceptions.CustomExceptions;
using AFBack.Infrastructure.Middleware;

namespace AFBack.Infrastructure.Validator;

public class BaseValidator<T>
{
    // ReSharper disable once InconsistentNaming
    protected readonly ILogger<T> _logger;
    protected BaseValidator(ILogger<T> logger)
    {
        _logger = logger;
    }
    
    protected void ValidateAndThrowWithLog(bool condition, string logMessage, string userMessage, params object[] logParams)
    {
        if (!condition)
            return;

        _logger.LogWarning(logMessage, logParams);
        throw new ValidationException(userMessage);
    }
    
    protected void ValidateAndThrow(bool condition, string userMessage)
    {
        if (!condition)
            return;
        
        throw new ValidationException(userMessage);
    }
    
    protected void ThrowIfNotFound(bool condition, string userMessage)
    {
        if (!condition)
            return;
        
        throw new NotFoundException(userMessage);
    }
}
