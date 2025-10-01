using AFBack.Infrastructure.DTO;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.ModelBinding;

namespace AFBack.Infrastructure.Services;

public class ResponseService
{
    
    /// <summary>
    /// Ved suksess så sender vi data med denne metoden
    /// </summary>
    /// <param name="data">DTOen</param>
    /// <param name="message">Suksess meldingen</param>
    /// <typeparam name="T">Typen data, feks MessageResponse</typeparam>
    /// <returns></returns>
    public ActionResult<ApiResponse<T>> Success<T>(T? data, string message = "Operation completed successfully")
    {
        return new OkObjectResult(new ApiResponse<T>
        {
            Success = true,
            Message = message,
            Data = data
        });
    }
    
    /// <summary>
    /// Ved suksess når vi ikke har noe data å sende tilbake
    /// </summary>
    /// <param name="message"></param>
    /// <returns></returns>
    public ActionResult<ApiResponse<object>> Success(string message = "Operation completed successfully")
    {
        return Success<object>(null, message);
    }
    
    /// <summary>
    /// Hvis noe data ikke er korrekt, så returner vi denne til frontend
    /// </summary>
    /// <param name="message"></param>
    /// <returns></returns>
    public ActionResult<ApiResponse<object>> BadRequest(string message)
    {
        return new BadRequestObjectResult(new ApiResponse<object>
        {
            Success = false,
            Message = message
        });
    }
    
    /// <summary>
    /// Hvis noe data ikke er korrekt, så returner vi denne til frontend
    /// Generisk metode som brukes der det er response
    /// </summary>
    /// <param name="message"></param>
    /// <returns></returns>
    public ActionResult<ApiResponse<T>> BadRequest<T>(string message)
    {
        return new BadRequestObjectResult(new ApiResponse<T>
        {
            Success = false,
            Message = message,
            Data = default
        });
    }
    
    /// <summary>
    /// Hvis noe ikke er validert korrekt så returner vi en (400)
    /// </summary>
    /// <param name="modelState"></param>
    /// <returns></returns>
    public ActionResult<ApiResponse<object>> ValidationError(ModelStateDictionary modelState)
    {
        var errors = modelState
            .Where(kvp => kvp.Value?.Errors.Count > 0)
            .ToDictionary(kvp => kvp.Key, kvp => kvp.Value!.Errors.Select(error => error.ErrorMessage).ToArray());

        return new BadRequestObjectResult(new ApiResponse<object>
        {
            Success = false,
            Message = "Validation failed",
            Errors = errors
        });
    }
    
    /// <summary>
    /// Hvis et endepunkt ikke finnes så returner vi denne
    /// </summary>
    /// <param name="message"></param>
    /// <returns></returns>
    public ActionResult<ApiResponse<object>> NotFound(string message = "Resource not found")
    {
        return new NotFoundObjectResult(new ApiResponse<object>
        {
            Success = false,
            Message = message
        });
    }
    
    /// <summary>
    /// Hvis et endepunkt ikke finnes så returner vi denne
    /// /// Generisk metode som brukes der det er response
    /// </summary>
    /// <param name="message"></param>
    /// <returns></returns>
    public ActionResult<ApiResponse<T>> NotFound<T>(string message = "Resource not found")
    {
        return new NotFoundObjectResult(new ApiResponse<T>
        {
            Success = false,
            Message = message,
            Data = default
        });
    }
    
    /// <summary>
    /// Vi returnerer denne hvis brukeren ikke er authenticated
    /// </summary>
    /// <param name="message"></param>
    /// <returns></returns>
    public ActionResult<ApiResponse<object>> Unauthorized(string message = "Authentication required")
    {
        return new ObjectResult(new ApiResponse<object>
        {
            Success = false,
            Message = message
        })
        {
            StatusCode = StatusCodes.Status401Unauthorized
        };
    }
    
    /// <summary>
    /// Vi returnerer denne hvis brukeren ikke er authenticated
    /// Generisk metode som brukes der det er response
    /// </summary>
    /// <param name="message"></param>
    /// <returns></returns>
    public ActionResult<ApiResponse<T>> Unauthorized<T>(string message = "Authentication required")
    {
        return new ObjectResult(new ApiResponse<T>
        {
            Success = false,
            Message = message,
            Data = default
        })
        {
            StatusCode = StatusCodes.Status401Unauthorized
        };
    }
    
    /// <summary>
    /// Hvis en bruker prøver å få tilgang til noe de ikke har
    /// </summary>
    /// <param name="message"></param>
    /// <returns></returns>
    public ActionResult<ApiResponse<object>> Forbidden(
        string message = "You don't have permission to access this resource")
    {
        return new ObjectResult(new ApiResponse<object>
        {
            Success = false,
            Message = message
        })
        {
            StatusCode = StatusCodes.Status403Forbidden
        };
    }
    
    /// <summary>
    /// Hvis en bruker prøver å få tilgang til noe de ikke har
    /// Generisk metode som brukes der det er response
    /// </summary>
    /// <param name="message"></param>
    /// <returns></returns>
    public ActionResult<ApiResponse<T>> Forbidden<T>(
        string message = "You don't have permission to access this resource")
    {
        return new ObjectResult(new ApiResponse<T>
        {
            Success = false,
            Message = message,
            Data = default
        })
        {
            StatusCode = StatusCodes.Status403Forbidden
        };
    }
    
    
    /// <summary>
    /// Hvis vi prøver å opprette noe allerede eksisterende så bruker vi denne
    /// </summary>
    /// <param name="message"></param>
    /// <returns></returns>
    public ActionResult<ApiResponse<object>> Conflict(string message = "Resource already exists")
    {
        return new ObjectResult(new ApiResponse<object>
        {
            Success = false,
            Message = message
        })
        {
            StatusCode = StatusCodes.Status409Conflict
        };
    }
    
    /// <summary>
    /// Hvis vi prøver å opprette noe allerede eksisterende så bruker vi denne
    /// Generisk metode som brukes der det er response
    /// </summary>
    /// <param name="message"></param>
    /// <returns></returns>
    public ActionResult<ApiResponse<T>> Conflict<T>(string message = "Resource already exists")
    {
        return new ObjectResult(new ApiResponse<T>
        {
            Success = false,
            Message = message,
            Data = default
        })
        {
            StatusCode = StatusCodes.Status409Conflict
        };
    }
    
    /// <summary>
    /// Hvis noe er galt på serveren så returner vi denne
    /// </summary>
    /// <param name="message"></param>
    /// <typeparam name="T"></typeparam>
    /// <returns></returns>
    public ActionResult<ApiResponse<T>> ServerError<T>(string message = "An internal server error occurred")
    {
        return new ObjectResult(new ApiResponse<T>
        {
            Success = false,
            Message = message,
            Data = default
        })
        {
            StatusCode = StatusCodes.Status500InternalServerError
        };
    }
    
    /// <summary>
    /// Når vi har opprettet et object og trenger å returnere det
    /// </summary>
    /// <param name="data"></param>
    /// <param name="location"></param>
    /// <param name="message"></param>
    /// <typeparam name="T"></typeparam>
    /// <returns></returns>
    public ActionResult<ApiResponse<T>> Created<T>(T data, string location,
        string message = "Resource created successfully")
    {
        return new CreatedResult(location, new ApiResponse<T>
        {
            Success = true,
            Message = message,
            Data = data
        });
    }
    
    /// <summary>
    /// Når ikke noe innhold har endret seg
    /// </summary>
    /// <returns></returns>
    public StatusCodeResult  NotModified()
    {
        return new StatusCodeResult(StatusCodes.Status304NotModified);
    }
    
    /// <summary>
    /// Når innhold ble slettet
    /// </summary>
    /// <returns></returns>
    public NoContentResult NoContent()
    {
        return new NoContentResult();
    }
}