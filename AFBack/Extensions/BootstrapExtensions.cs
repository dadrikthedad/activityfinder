using AFBack.DTOs;
using AFBack.DTOs.BoostrapDTO;
using AFBack.Models;
using AFBack.Models.Auth;
using AFBack.Models.User;
using UserSettingsDTO = AFBack.DTOs.UserSettingsDTO;

namespace AFBack.Extensions
{
    public static class BoostrapExtensions
    {
        public static UserSummaryDto ToUserSummaryDTO(this AppUser appUser)
        {
            return new UserSummaryDto
            { 
                Id = appUser.Id,
                FullName = appUser.FullName,
                ProfileImageUrl = appUser.ProfileImageUrl
            };
        }

        // Overload for når du trenger å sette GroupRequestStatus
        public static UserSummaryDto ToUserSummaryDTO(this AppUser appUser, GroupRequestStatus? groupRequestStatus)
        {
            return new UserSummaryDto
            {
                Id = appUser.Id,
                FullName = appUser.FullName,
                ProfileImageUrl = appUser.ProfileImageUrl,
            };
        }

        // Bulk conversion for lists
        public static List<UserSummaryDto> ToUserSummaryDTOs(this IEnumerable<AppUser> users)
        {
            return users.Select(u => u.ToUserSummaryDTO()).ToList();
        }

        // Null-safe bulk conversion
        public static List<UserSummaryDto> ToUserSummaryDTOsSafe(this IEnumerable<AppUser>? users) 
        { 
            return users?.Select(u => u.ToUserSummaryDTO()).ToList() ?? new List<UserSummaryDto>();
        }

        public static UserSettingsDTO ToUserSettingsDTO(this UserSettings? settings)
        {
            if (settings == null)
            { 
                return new UserSettingsDTO { Language = "nb-NO" }; 
            }
            return new UserSettingsDTO { Language = settings.Language ?? "nb-NO" };
        }
    }
}
