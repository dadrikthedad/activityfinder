using AFBack.Infrastructure.Middleware;

namespace AFBack.Infrastructure.Services;

public abstract class BaseService<T>
{
    // ReSharper disable once InconsistentNaming
    protected readonly ILogger<T> _logger;

    protected BaseService(ILogger<T> logger)
    {
        _logger = logger;
    }
    
    /// <summary>
    /// Vi sjekker en condition om den er true hvis ikke så logger vi det og kaster en exception
    /// </summary>
    /// <param name="condition"></param>
    /// <param name="logMessage"></param>
    /// <param name="userMessage"></param>
    /// <param name="logParams"></param>
    /// <exception cref="Exception"></exception>
    public void ValidateAndThrow(bool condition, string logMessage, string userMessage, params object[] logParams)
    {
        if (!condition)
            return;
        _logger.LogWarning(logMessage, logParams);
        throw new ValidationException(userMessage);
    }
    
    public void LogErrorAndThrow(string logMessage, string userMessage, params object[] logParams)
    {
        _logger.LogError(logMessage, logParams);
        throw new Exception(userMessage);
    }

    public void LogError(string logMessage, params object[] logParams)
    {
        _logger.LogError(logMessage, logParams);
    }

    public void LogSuccess(string message, params object[] parameters)
    {
        _logger.LogInformation(message, parameters);
    }
    
    public void LogDebug(string message, params object[] parameters)
    {
        _logger.LogDebug(message, parameters);
    }
}
