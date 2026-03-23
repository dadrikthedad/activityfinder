using AFBack.Common.Enum;
using AFBack.Common.Results;
using Microsoft.AspNetCore.Mvc;

namespace AFBack.Common.Controllers
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

            return BuildProblemResult(result.ErrorCode, result.Error);
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

            return BuildProblemResult(result.ErrorCode, result.Error);
        }
        
        /// <summary>
        /// Bygger et ProblemDetails-svar fra en AppErrorCode og feilmelding.
        /// Utleder HTTP-statuskode og tittel fra koden.
        /// </summary>
        private ActionResult BuildProblemResult(AppErrorCode code, string detail)
        {
            var (statusCode, title) = code switch
            {
                AppErrorCode.NotFound => (StatusCodes.Status404NotFound, "Not Found"),
                AppErrorCode.Conflict or AppErrorCode.EmailAlreadyExists => (StatusCodes.Status409Conflict, "Conflict"),
                AppErrorCode.Unauthorized
                    or AppErrorCode.InvalidCredentials
                    or AppErrorCode.EmailNotConfirmed
                    or AppErrorCode.PhoneNotConfirmed
                    or AppErrorCode.TokenExpired
                    or AppErrorCode.InvalidToken => (StatusCodes.Status401Unauthorized, "Unauthorized"),
                AppErrorCode.Forbidden or AppErrorCode.AccountLocked  => (StatusCodes.Status403Forbidden, "Forbidden"),
                AppErrorCode.Gone => (StatusCodes.Status410Gone, "Gone"),
                AppErrorCode.TooManyRequests => (StatusCodes.Status429TooManyRequests, "Too Many Requests"),
                AppErrorCode.Validation or AppErrorCode.InvalidRegistrationData
                    or AppErrorCode.InvalidCode => (StatusCodes.Status422UnprocessableEntity, "Unprocessable Entity"),
                AppErrorCode.InternalError => (StatusCodes.Status500InternalServerError, "Internal Server Error"),
                _  => (StatusCodes.Status400BadRequest,                "Bad Request"),
            };

            return StatusCode(statusCode, new AppProblemDetails
            {
                Status = statusCode,
                Title  = title,
                Detail = detail,
                Code   = (int)code
            });
        }
        
        /// <summary>
        /// Henter ut IP-addresse fra HttpContexten
        /// </summary>
        /// <returns>IP-adressen</returns>
        /// <exception cref="InvalidOperationException">Serverfeil hvis ikke konfigurert riktig</exception>
        protected string GetIpAddress() =>
            HttpContext.Connection.RemoteIpAddress?.ToString()
            ?? throw new InvalidOperationException(
                "RemoteIpAddress is null. Check ForwardedHeaders configuration.");
    }
}
