using AFBack.Common.Enum;

namespace AFBack.Common.Results;

/// <summary>
/// Results without a value, used for operations that only return success/failure
/// (e.g., validation, void operations)
/// </summary>
public class Result
{
    public bool IsSuccess { get; }
    public string Error { get; }
    public AppErrorCode ErrorCode { get; }
    public bool IsFailure => !IsSuccess;

    private Result(bool isSuccess, string? error, AppErrorCode errorCode)
    {
        if (isSuccess && error != null)
            throw new InvalidOperationException("A successful result cannot have an error");
       
        if (!isSuccess && error == null)
            throw new InvalidOperationException("A failed result must have an error");

        IsSuccess = isSuccess;
        Error = error ?? string.Empty;
        ErrorCode = errorCode;
    }
   
    /// <summary>
    /// Creates a successful result
    /// </summary>
    public static Result Success() => new(true, null, default);
   
    /// <summary>
    /// Creates a failed result with an error message
    /// </summary>
    public static Result Failure(string error, AppErrorCode code)
        => new(false, error, code);
}

/// <summary>
/// Object used to send error information from the service layer to the controller
/// in a clean and efficient manner.
/// </summary>
/// <typeparam name="T">The type of the returned value, typically a response object or a string.</typeparam>
public class Result<T>
{
    public bool IsSuccess { get; }
    public T? Value { get;  }
    public string Error { get; }
    public AppErrorCode ErrorCode { get; }
    public bool IsFailure => !IsSuccess;


    private Result(bool isSuccess, T? value, string? error, AppErrorCode errorCode)
    {
        if (isSuccess && error != null)
            throw new InvalidOperationException("A successful result cannot have an error");
      
        if (!isSuccess && error == null)
            throw new InvalidOperationException("A failed result must have an error");


        IsSuccess = isSuccess;
        Value = value;
        Error = error ?? string.Empty;
        ErrorCode = errorCode;
    }
  
    /// <summary>
    /// Sets isSuccess = true, data as required parameter, errors = null and errorType = null
    /// </summary>
    /// <param name="data">The Response-object to send to the controller</param>
    public static Result<T> Success(T data) => new(true, data, null,default);
  
    /// <summary>
    /// Sets isSuccess = false, data = default, errors as required parameter and errorType to
    /// BadRequest if not specified
    /// </summary>
    public static Result<T> Failure(string error, AppErrorCode code)
        => new(false, default, error, code);
}

