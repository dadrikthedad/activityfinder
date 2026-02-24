using AFBack.Cache;
using AFBack.Common.Enum;
using AFBack.Common.Results;
using AFBack.Features.Auth.Repositories;
using AFBack.Features.Blocking.Services;
using AFBack.Features.Friendship.DTOs.Responses;
using AFBack.Features.Friendship.Enums;
using AFBack.Features.Friendship.Repository;
using AFBack.Features.SignalR.Constants;
using AFBack.Features.SignalR.Services;
using AFBack.Features.SyncEvents.Enums;
using AFBack.Features.SyncEvents.Services;


namespace AFBack.Features.Friendship.Services;

public class FriendshipService(
    ILogger<FriendshipService> logger,
    IUserRepository userRepository,
    IFriendshipRepository friendshipRepository,
    IBlockingService blockingService,
    ISyncService syncService,
    IUserSummaryCacheService userSummaryCacheService,
    ISignalRNotificationService signalRNotificationService,
    IFriendshipRequestRepository friendshipRequestRepository) : IFriendshipService
{
    
}
