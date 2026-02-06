using AFBack.Common;
using AFBack.Common.Results;
using AFBack.Features.Auth.Models;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.Data;

namespace AFBack.Features.Auth.Services;

public class AuthService(
   UserManager<AppUser> userManager,
   ILogger<AuthService> logger,
   IJwtService jwtService,
   IPasswordHashService passwordHashService) : IAuthService
{


   public async Task<Result<SignupResponse>> SignupAsync(SignupRequest request)
   {
       logger.LogInformation("SignupAsync. Payload: {@Payload}", new {request.Email});
      
       var existingUser = await userManager.FindByEmailAsync(request.Email);
       if (existingUser != null)
           return Result<SignupResponse>.Failure("A user with this email already exists", ErrorTypeEnum.Conflict);
      
       var user = new AppUser
       {
           UserName = request.Email,
           Email = request.Email,
           EmailConfirmed = false,
           FirstName = request.FirstName.Trim(),
           LastName = request.LastName.Trim(),
           DateOfBirth = DateOnly.FromDateTime(request.DateOfBirth!.Value)
       };
      
       var createUserResult = await userManager.CreateAsync(user, request.Password);
       if (!createUserResult.Succeeded)
       {
           var errors = string.Join(" ", createUserResult.Errors.Select(e => e.Description));
           logger.LogWarning("Failed to create user {Email}: {Errors}", request.Email, errors);
           return Result<SignupResponse>.Failure(errors);
       }


       var addRoleResult = await userManager.AddToRoleAsync(user, AppRoles.User);
       if (!addRoleResult.Succeeded)
       {
           await userManager.DeleteAsync(user);
           throw new InvalidOperationException($"Could not add Role {AppRoles.User} to UserId: {user.Id}");
       }
      
       return Result<SignupResponse>.Success(
           new SignupResponse { Message = "User created successfully. Please verify your email."});
   }


   public async Task<Result<LoginResponse>> LoginAsync(LoginRequest request)
   {
       logger.LogInformation("LoginAsync. Payload: {@Payload}", new { request.Email });


       var user = await userManager.FindByEmailAsync(request.Email);
      
       if (user == null)
           logger.LogWarning("Login failed. User not found for {Email}", request.Email);
      
       if (user != null && await userManager.IsLockedOutAsync(user))
       {
           var lockoutEnd = await userManager.GetLockoutEndDateAsync(user);
           logger.LogWarning("Login failed. Account locked for {Email} until {LockoutEnd}",
               request.Email, lockoutEnd);
           return Result<LoginResponse>.Failure(
               "Your account has been locked due to multiple failed login attempts. Please try again later.");
       }


       var targetUser = user ?? DummyUser;
      
       var isPasswordValid = await userManager.
           CheckPasswordAsync(targetUser, request.Password);
      
       if (user == null || !isPasswordValid)
       {
           if (user != null)
               await userManager.AccessFailedAsync(user);
          
           logger.LogWarning("Login failed. Invalid password for {Email}", request.Email);
           return Result<LoginResponse>.Failure("Wrong email or password");
       }
      
       // if (!user.EmailConfirmed)
       // {
       //     logger.LogWarning("Login failed. Email not confirmed for {Email}", request.Email);
       //     return Result<LoginResponse>.Failure("Please confirm your email before logging in",
       //         ErrorTypeEnum.Unauthorized);
       // }
      
       await userManager.ResetAccessFailedCountAsync(user);
      
       var roles = await userManager.GetRolesAsync(user);
       var token = jwtService.GenerateJwtToken(user.Id, request.Email, roles);


       var loginResponse = new LoginResponse
       {
           UserId = user.Id,
           Email = request.Email,
           Name = user.FullName,
           Token = token
       };


       return Result<LoginResponse>.Success(loginResponse);
   }
  
   private static readonly AppUser DummyUser = new ()
   {
       Id = "00000000-0000-0000-0000-000000000000",
       UserName = "dummy@example.com",
       NormalizedUserName = "DUMMY@EXAMPLE.COM",
       Email = "dummy@example.com",
       NormalizedEmail = "DUMMY@EXAMPLE.COM",
       PasswordHash = "rOvscqlQVuUAtxqrUuyWZLRUHAUs1BDZm2k02/Y+IKgoxH9X8Ac/TvsP5oyMaMOk"
   };
}

