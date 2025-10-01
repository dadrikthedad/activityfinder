using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using AFBack.Data;
using AFBack.Features.Cache;
using AFBack.Features.Cache.Interface;
using AFBack.Infrastructure.DTO;
using AFBack.Infrastructure.Services;
using AFBack.Models;

namespace AFBack.Controllers
{
    [ApiController]
    public abstract class BaseController<T>(ApplicationDbContext context, ILogger logger, IUserCache userCache, ResponseService responseService)
        : ControllerBase
    {
        protected readonly ApplicationDbContext _context = context;
        protected readonly ILogger _logger = logger;
        protected readonly IUserCache _userCache = userCache;
        protected readonly ResponseService _responseService = responseService;

        // Metode for å kun hente ut burkerId
        protected int? GetUserId()
        {
            var claimValue = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            return int.TryParse(claimValue, out var id) ? id : null;
        }
        
        // Henter User-objektet med brukerId vi får fra GetUserId()-metoden
        protected async Task<User?> GetUserFromClaims()
        {
            var userId = GetUserId();
            if (userId == null)
                return null;

            return await _userCache.GetUserAsync(userId.Value);
        }
        
        // ============================================ VALIDATION ===================================================
        
        /// <summary>
        /// Validerer at brukeren eksisterer i cache eller databasen. Returnerer ingenting
        /// </summary>
        /// <returns></returns>
        protected async Task<ActionResult<ApiResponse<object>>?> ValidateUserExists() // TODO: Legg på IP Her
        {   
            // Henter Id fra token
            var userId = GetUserId();
            
            // Ingen ID, return Unauthorized
            if (userId == null)
            {
                _logger.LogWarning("Unauthorized access attempt! No userId in token");
                return _responseService.Unauthorized("User ID not found in token");
                
            }
            
            // Sjekker i cache/databasen om brukeren eksisterer
            if (!await _userCache.UserExistsAsync(userId.Value))
            {
                _logger.LogWarning("Unauthorized access attempt! User {UserId} does not exists", userId);
                return _responseService.BadRequest("User not found");
            }
            
            // Success
            return null;
        }
        
        /// <summary>
        /// Validerer UserId fra token og returnerer userId
        /// </summary>
        /// <returns></returns>
        protected async Task<(int userId, ActionResult<ApiResponse<object>>? error)> FullValidateAndGetIdFromToken()
        {   
            // Henter Id fra token
            var userId = GetUserId();
            
            // Ingen ID, return Unauthorized
            if (userId == null)
            {
                _logger.LogWarning("Unauthorized access attempt! No userId in token");
                return (0, _responseService.Unauthorized("User ID not found in token"));
                
            }
            
            // Sjekker i cache/databasen om brukeren eksisterer
            if (!await _userCache.UserExistsAsync(userId.Value))
            {
                _logger.LogWarning("Unauthorized access attempt! User {UserId} does not exists", userId);
                
                return (0, _responseService.BadRequest("User not found"));
            }
            
            // Success
            return (userId.Value, null);
        }
        
        /// <summary>
        /// Validerer UserId fra token og returnerer userId
        /// </summary>
        /// <returns></returns>
        protected async Task<(int userId, ActionResult<ApiResponse<T>>? error)> ValidateAndGetIdFromToken<T>()
        {   
            // Henter Id fra token
            var userId = GetUserId();
            
            // Ingen ID, return Unauthorized
            if (userId == null)
            {
                _logger.LogWarning("Unauthorized access attempt! No userId in token");
                return (0, _responseService.Unauthorized<T>("User ID not found in token"));
                
            }
            
            // Success
            return (userId.Value, null);
        }
        
        
        /// <summary>
        /// Valider at det er en token og at den ikke er null
        /// </summary>
        /// <param name="user"></param>
        /// <returns></returns>
        protected ActionResult<ApiResponse<object>?> ValidateUser(User? user)
        {
            if (user != null)
                return null;
            
            _logger.LogWarning("Unauthorized access attempt."); // TODO: Legge på IP her
            return _responseService.Unauthorized("Invalid or missing authorization");
        }
        
        
        protected IActionResult? ValidateModel<T>(T model, Func<T, bool> validator, string errorMessage,
            params object[] logParams)
        {
            if (validator(model)) 
                return null;

            _logger.LogWarning("Model validation failed: " + errorMessage, logParams);
            return BadRequest(errorMessage);
        }
        
        /// <summary>
        /// Tar inn en condition og returnerer null eller 
        /// </summary>
        /// <param name="condition"></param>
        /// <param name="logMessage"></param>
        /// <param name="errorMessage"></param>
        /// <param name="logParams"></param>
        /// <returns></returns>
        protected ActionResult<ApiResponse<object>>? ValidateCondition(bool condition, string logMessage, string errorMessage,
            params object[] logParams)
        {
            if (!condition)
                return null;

            _logger.LogWarning(logMessage, logParams);
            return _responseService.BadRequest(errorMessage);
        }
        
        /// <summary>
        /// 
        /// </summary>
        /// <param name="condition"></param>
        /// <param name="logMessage"></param>
        /// <param name="errorMessage"></param>
        /// <param name="logParams"></param>
        /// <typeparam name="T"></typeparam>
        /// <returns></returns>
        protected ActionResult<ApiResponse<T>>? ValidateCondition<T>(bool condition, string logMessage, string errorMessage,
            params object[] logParams)
        {
            if (!condition)
                return null;

            _logger.LogWarning(logMessage, logParams);
            return _responseService.BadRequest<T>(errorMessage);
        }

        protected IActionResult HandleException(Exception ex, string operation, params object[] logParams)
        {
            _logger.LogError(ex, $"Error in {operation}", logParams);
            return StatusCode(500, new { messge = $"An error occurred: {ex.Message}" });
        }
        
    }
}