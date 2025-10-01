using AFBack.DTOs;
using AFBack.DTOs.BoostrapDTO;
using AFBack.Models;
using UserSettingsDTO = AFBack.DTOs.UserSettingsDTO;

namespace AFBack.Extensions
{
    public static class BoostrapExtensions
    {
        public static UserSummaryDTO ToUserSummaryDTO(this User user)
        {
            return new UserSummaryDTO
            { 
                Id = user.Id,
                FullName = user.FullName,
                ProfileImageUrl = user.ProfileImageUrl
                // GroupRequestStatus settes til null som default (kan overstyres senere)
            };
        }

        // Overload for når du trenger å sette GroupRequestStatus
        public static UserSummaryDTO ToUserSummaryDTO(this User user, GroupRequestStatus? groupRequestStatus)
        {
            return new UserSummaryDTO
            {
                Id = user.Id,
                FullName = user.FullName,
                ProfileImageUrl = user.ProfileImageUrl,
                GroupRequestStatus = groupRequestStatus
            };
        }

        // Bulk conversion for lists
        public static List<UserSummaryDTO> ToUserSummaryDTOs(this IEnumerable<User> users)
        {
            return users.Select(u => u.ToUserSummaryDTO()).ToList();
        }

        // Null-safe bulk conversion
        public static List<UserSummaryDTO> ToUserSummaryDTOsSafe(this IEnumerable<User>? users) 
        { 
            return users?.Select(u => u.ToUserSummaryDTO()).ToList() ?? new List<UserSummaryDTO>();
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
