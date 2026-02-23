using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using AFBack.Configurations.Options;
using AFBack.Features.Auth.Services.Interfaces;
using AFBack.Infrastructure.Constants;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

namespace AFBack.Features.Auth.Services;

/// <summary>
/// Service som generer JWT Token med claims og innstillinger fra appsettings
/// </summary>
/// <param name="jwtSettings"></param>
public class JwtService(IOptions<JwtSettings> jwtSettings) : IJwtService
{
    private readonly JwtSettings _jwtSettings = jwtSettings.Value;
  
    /// <inheritdoc />
    public string GenerateJwtToken(string userId, string email, IEnumerable<string>? roles, int deviceId)
    {
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_jwtSettings.Key));
        var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
      
        var claims = new List<Claim>
        {
            new (JwtRegisteredClaimNames.Sub, userId),
            new (JwtRegisteredClaimNames.Email, email),
            new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
            new(CustomClaimTypes.DeviceId, deviceId.ToString())
        };
      
        if (roles != null)
            claims.AddRange(roles.Select(role => new Claim("role", role)));
      
        var token = new JwtSecurityToken(
            issuer: _jwtSettings.Issuer,
            audience: _jwtSettings.Audience,
            claims: claims,
            expires: DateTime.UtcNow.AddMinutes(TokenConfig.AccessTokenMinutes),
            signingCredentials: credentials
        );
        
        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}
