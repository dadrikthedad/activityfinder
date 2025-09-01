// notificationHandlers.ts - Alle notification-relaterte handlers
import { useNotificationStore } from "@/store/useNotificationStore";
import { NotificationDTO } from "@shared/types/NotificationEventDTO";
import { LocalToastType } from "@/components/toast/NotificationToastNative";
import { showNotificationToastNative } from "@/components/toast/NotificationToastNative";
import { getFriendInvitationById } from "@/services/friends/friendService";
import { getNotificationById } from "@/services/notifications/notificationService";
import { finalizeConversationApproval } from "@/hooks/messages/finalizeConversationApproval";
import { useUserCacheStore } from "@/store/useUserCacheStore";
import authServiceNative from '@/services/user/authServiceNative';


export const handleNotification = async (
  evt: NotificationDTO,
) => {
  console.log("🔔 Notification received via useChatHub:", evt);
 
  const {
    addNotification,
    addFriendRequest,
    setFriendRequestTotalCount,
    friendRequestTotalCount,
    notifications: notificationsRef
  } = useNotificationStore.getState();

  try {
    if (evt.type === "FriendInvitation") {
      const token = await authServiceNative.getAccessToken();
      if (!token || !evt.friendInvitationId) return;
      const fr = await getFriendInvitationById(evt.friendInvitationId, token);
      addNotification(evt);
      if (fr) {
        addFriendRequest(fr);
        setFriendRequestTotalCount(friendRequestTotalCount + 1);
        showNotificationToastNative({
          senderName: fr.userSummary?.fullName ?? "Someone",
          conversationId: -1,
          type: LocalToastType.FriendRequestReceived,
        });
      }
      return;
    }

    if (evt.type === "FriendInvAccepted") {
      addNotification(evt);
      if (evt.relatedUser) {
        // ✅ Bruk setUserFriendStatus i stedet for setUser
        const { setUserFriendStatus, setUser } = useUserCacheStore.getState();
        
        // Først sørg for at brukeren eksisterer i cache
        setUser(evt.relatedUser);
        
        // Deretter sett vennestatus eksplisitt
        setUserFriendStatus(evt.relatedUser.id, true);
       
        console.log('🤝 Friend added to user cache:', evt.relatedUser.fullName);
        showNotificationToastNative({
          senderName: evt.relatedUser.fullName ?? "Someone",
          type: LocalToastType.FriendInvAccepted,
          relatedUser: evt.relatedUser,
        });
      }
      if (evt.conversationId) {
        await finalizeConversationApproval(evt.conversationId);
      }
      return;
    }

    if (evt.message || evt.relatedUser) {
      addNotification(evt);
      return;
    }

    const cached = notificationsRef.find((n) => n.id === evt.id);
    if (cached) {
      addNotification(cached);
      return;
    }

    const token = await authServiceNative.getAccessToken();
    if (!token) return;
    const full = await getNotificationById(evt.id, token);
    if (full) addNotification(full);
  } catch (err) {
    console.error("❌ Realtime-handler feilet:", err);
  }
};