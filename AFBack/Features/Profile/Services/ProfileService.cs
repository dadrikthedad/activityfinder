using AFBack.Common.Enum;
using AFBack.Common.Results;
using AFBack.Features.Friendship.Repository;
using AFBack.Features.Profile.DTOs.Requests;
using AFBack.Features.Profile.DTOs.Responses;
using AFBack.Features.Profile.Extensions;
using AFBack.Features.Profile.Repository;
using AFBack.Features.SyncEvents.Enums;
using AFBack.Features.SyncEvents.Services;
using AFBack.Infrastructure.Cache;


namespace AFBack.Features.Profile.Services;

public class ProfileService(
    ILogger<ProfileService> logger,
    IProfileRepository profileRepository,
    IUserSummaryCacheService userSummaryCacheService,
    IFriendshipRepository friendshipRepository,
    ISyncService syncService) : IProfileService
{   
    
    // ======================== GET ======================== 
    
    /// <inheritdoc/>
    public async Task<Result<MyProfileResponse>> GetMyProfileAsync(string userId)
    {
        var profile = await profileRepository.GetProfileByUserAsync(userId);
        if (profile == null)
            return Result<MyProfileResponse>.Failure("Profile not found", ErrorTypeEnum.NotFound);
        
        return Result<MyProfileResponse>.Success(profile.ToMyProfileResponse());
    }

    /// <inheritdoc/>
    public async Task<Result<PublicProfileResponse>> GetPublicProfileAsync(string userId, 
        string targetUserId)
    {
        // Henter profilen til brukerne
        var profile = await profileRepository.GetProfileWithNavigationsAsync(targetUserId);
        if (profile == null)
            return Result<PublicProfileResponse>.Failure("Profile not found", 
                ErrorTypeEnum.NotFound);
        
        // Settings i egen variabel for DRY
        var settings = profile.AppUser?.UserSettings;

        if (!settings!.PublicProfile)
        {
            return Result<PublicProfileResponse>.Success(new PublicProfileResponse
            {
                Id = profile.UserId,
                FullName = profile.AppUser!.FullName,
                ProfileImageUrl = profile.AppUser.ProfileImageUrl,
                IsPrivate = true
            });
        }

        var response = profile.ToPublicResponse(settings);
        
        // Bruker viser venner
        if (settings.ShowFriendsList)
        {   
            // Hent alle venner sine ID-er
            var friendIds = await friendshipRepository.GetAllFriendIdsAsync(targetUserId);
            // Hent navn og profilbilder fra Cache
            var friendSummaries = 
                await userSummaryCacheService.GetUserSummariesAsync(friendIds);
            // Map til response
            response.Friends = friendSummaries.Values.ToList();
            response.FriendCount = friendIds.Count;
        }

        return Result<PublicProfileResponse>.Success(response);
    }
    
    // ======================== Update ======================== 

    /// <inheritdoc/>
    public async Task<Result> UpdateProfileAsync(string userId, UpdateProfileRequest request)
    {
        logger.LogInformation("User {UserId} is updating profile", userId);
        
        // Henter profilen
        var profile = await profileRepository.GetProfileByUserAsync(userId);
        if (profile == null)
        {
            logger.LogWarning("UserProfile for {UserId} does not exist", userId);
            return Result.Failure("User not found", ErrorTypeEnum.NotFound);
        }

        // Lokasjon
        profile.CountryCode = request.CountryCode;
        profile.Region = request.Region;
        profile.City = request.City;
        profile.PostalCode = request.PostalCode;

        // Demografi
        profile.DateOfBirth = request.DateOfBirth;
        profile.Gender = request.Gender;

        // Profilinnhold
        profile.Bio = request.Bio;
        profile.ContactEmail = request.ContactEmail;
        profile.ContactPhone = request.ContactPhone;
        
        // Oppdatgerer kun WebSite hvis det er satt. Er den null fra frontend så fjernes det
        if (request.Websites != null)
            profile.SetWebsites(request.Websites);
        else
            profile.WebsitesCsv = null;

        profile.UpdatedAt = DateTime.UtcNow;

        await profileRepository.SaveChangesAsync();
        
        // Sync til brukerens andre enheter
        await syncService.CreateSyncEventsAsync([userId], 
            SyncEventType.MyProfileDetailsUpdated, profile.ToMyProfileResponse());

        logger.LogInformation("User {UserId} updated profile successfully", userId);
        return Result.Success();
    }
}
