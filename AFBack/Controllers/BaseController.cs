using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace AFBack.Controllers
{
    [ApiController]
    public abstract class BaseController : ControllerBase
    {
        protected int? GetUserId()
        {
            var claimValue = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            return int.TryParse(claimValue, out var id) ? id : null;
        }
    }
}