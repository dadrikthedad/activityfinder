using AFBack.Common.Results;
using AFBack.Data;
using AFBack.Features.Auth.DTOs.Request;
using AFBack.Features.Auth.DTOs.Response;
using AFBack.Features.Auth.Models;
using AFBack.Features.Auth.Services;
using AFBack.Features.Auth.Services.Interfaces;
using AFBack.Features.Dev.DTOs;
using AFBack.Infrastructure.Transactions;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;


namespace AFBack.Features.Dev.Services;

public class DevService(
    UserManager<AppUser> userManager,
    ILogger<AuthService> logger,
    IUserDeviceService userDeviceService,   
    ILoginHistoryService loginHistoryService,
    ITokenService tokenService,
    ITransactionService transactionService,
    AppDbContext context) : IDevService
{
    public async Task<Result<LoginResponse>> DevLoginAsync(VerifyMfaRequest request, string ipAddress,
         string? userAgent, CancellationToken ct = default)
   {
       // ====== Finn bruker (eller bruk DummyUser for timing-beskyttelse) ======
       var user = await userManager.FindByEmailAsync(request.Email);
           
       // ====== Utsted tokens + device tracking =====
       return await transactionService.ExecuteAsync(async innerCt =>
       {
           // Oppretter eller oppdaterer UserDevice for brukeren
           var device = await userDeviceService.ResolveOrCreateDeviceAsync(
               user!.Id, request.Device, ipAddress, innerCt);
            
           // ====== Hent roller og generer tokens ======
           var roles = await userManager.GetRolesAsync(user);
           var loginResponse = await tokenService.GenerateTokenPairAsync(
               user, device, roles, ipAddress, userAgent, innerCt);
            
           // ====== Oppretter Login-history ======
           await loginHistoryService.RecordLoginAsync(user.Id, device.Id, ipAddress, userAgent, innerCt);

           logger.LogInformation("MFA verified and login successful for {Email} on device {DeviceName}",
               request.Email, device.DeviceName);

           return Result<LoginResponse>.Success(loginResponse);
       }, ct);
   }
    
    public async Task<Result<List<DevUserDto>>> GetUsersAsync()
    {
        var users = await context.Users
            .OrderBy(u => u.FullName)
            .ThenBy(u => u.Id)
            .Select(u => new DevUserDto
            {
                Id = u.Id,
                FullName = u.FullName,
                ProfileImageUrl = u.ProfileImageUrl,
                Email = u.Email!
            })
            .ToListAsync();
        
        logger.LogInformation("Hvor mange brukere? {Users}", users.Count);
        
         return Result<List<DevUserDto>>.Success(users);
    }
}
