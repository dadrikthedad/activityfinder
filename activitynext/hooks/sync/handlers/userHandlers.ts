// import { useUserCacheStore } from '@/store/useUserCacheStore';
// import { useNotificationStore } from '@/store/useNotificationStore';

// export async function handleFriendRequestCreated(data: any): Promise<void> {
//   const { friendRequest } = data;
//   const notificationStore = useNotificationStore.getState();
  
//   notificationStore.addFriendRequest(friendRequest);
//   console.log(`👥 Friend request created from ${friendRequest.senderName} (via sync)`);
// }

// export async function handleFriendRequestApproved(data: any): Promise<void> {
//   const { friendRequestId, friendship } = data;
//   const notificationStore = useNotificationStore.getState();
//   const userCacheStore = useUserCacheStore.getState();
  
//   notificationStore.removeFriendRequest(friendRequestId);
//   userCacheStore.addFriend(friendship);
//   console.log(`✅ Friend request approved: ${friendship.friendName} (via sync)`);
// }

// export async function handleFriendAdded(data: any): Promise<void> {
//   const { friend } = data;
//   const userCacheStore = useUserCacheStore.getState();
  
//   userCacheStore.addFriend(friend);
//   console.log(`🤝 Friend added: ${friend.name} (via sync)`);
// }

// export async function handleFriendRemoved(data: any): Promise<void> {
//   const { friendId } = data;
//   const userCacheStore = useUserCacheStore.getState();
  
//   userCacheStore.removeFriend(friendId);
//   console.log(`💔 Friend removed: ${friendId} (via sync)`);
// }

// export async function handleUserOnline(data: any): Promise<void> {
//   const { userId } = data;
//   const userCacheStore = useUserCacheStore.getState();
  
//   userCacheStore.updateUserOnlineStatus(userId, true);
//   console.log(`🟢 User ${userId} came online (via sync)`);
// }

// export async function handleUserOffline(data: any): Promise<void> {
//   const { userId } = data;
//   const userCacheStore = useUserCacheStore.getState();
  
//   userCacheStore.updateUserOnlineStatus(userId, false);
//   console.log(`🔴 User ${userId} went offline (via sync)`);
// }
