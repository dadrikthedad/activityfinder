using Microsoft.AspNetCore.Mvc;
using AFBack.Common.Enum;
using AFBack.Common.Results;


namespace AFBack.Controllers
{
    [ApiController]
    public abstract class BaseController : ControllerBase
    {
        
        /// <summary>
        /// Method we use to send the correct error message in the controller. This keeps our controllers small,
        /// while also we send correct status codes as a <see cref="ProblemDetails"/>-object
        /// </summary>
        /// <param name="result">The result object containing the error information</param>
        /// <returns>An <see cref="IActionResult"/> representing the error.</returns>
        protected ActionResult HandleFailure(Result result)
        {
            if (result.IsSuccess)
                throw new InvalidOperationException("Cannot handle failure for a successful result");


            var (statusCode, title) = result.ErrorType switch
            {
                ErrorTypeEnum.NotFound => (StatusCodes.Status404NotFound, "Resource Not Found"),
                ErrorTypeEnum.Conflict => (StatusCodes.Status409Conflict, "Conflict"),
                ErrorTypeEnum.Unauthorized => (StatusCodes.Status401Unauthorized, "Unauthorized"),
                ErrorTypeEnum.Forbidden => (StatusCodes.Status403Forbidden, "Forbidden"),
                ErrorTypeEnum.Gone => (StatusCodes.Status410Gone, "Resource Gone"),
                ErrorTypeEnum.TooManyRequests => (StatusCodes.Status429TooManyRequests, "Too Many Requests"),
                ErrorTypeEnum.Validation => (StatusCodes.Status422UnprocessableEntity, "Validation Error"),
                _ => (StatusCodes.Status400BadRequest, "Bad Request")
            };
            
            return StatusCode(statusCode, new ProblemDetails
            {
                Detail = result.Error,
                Title = title,
                Status = statusCode,
            });
        }
        
        /// <summary>
        /// Method we use to send the correct error message in the controller. This keeps our controllers small,
        /// while also we send correct status codes as a <see cref="ProblemDetails"/>-object
        /// </summary>
        /// <param name="result">The result object containing the error information</param>
        /// <typeparam name="T">The type carried by the result. Usually a Response og string</typeparam>
        /// <returns>An <see cref="IActionResult"/> representing the error.</returns>
        protected ActionResult HandleFailure<T>(Result<T> result)
        {
            if (result.IsSuccess)
                throw new InvalidOperationException("Cannot handle failure for a successful result");


            var (statusCode, title) = result.ErrorType switch
            {
                ErrorTypeEnum.NotFound => (StatusCodes.Status404NotFound, "Resource Not Found"),
                ErrorTypeEnum.Conflict => (StatusCodes.Status409Conflict, "Conflict"),
                ErrorTypeEnum.Unauthorized => (StatusCodes.Status401Unauthorized, "Unauthorized"),
                ErrorTypeEnum.Forbidden => (StatusCodes.Status403Forbidden, "Forbidden"),
                ErrorTypeEnum.Gone => (StatusCodes.Status410Gone, "Resource Gone"),
                ErrorTypeEnum.TooManyRequests => (StatusCodes.Status429TooManyRequests, "Too Many Requests"),
                ErrorTypeEnum.Validation => (StatusCodes.Status422UnprocessableEntity, "Validation Error"),
                _ => (StatusCodes.Status400BadRequest, "Bad Request")
            };


            return StatusCode(statusCode, new ProblemDetails
            {
                Detail = result.Error,
                Title = title,
                Status = statusCode,
            });
        }
    }
}
