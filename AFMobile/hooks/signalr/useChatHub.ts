import { useEffect, useRef } from "react";
import { AppState, AppStateStatus } from 'react-native';
import { createChatConnection } from "@/utils/signalr/chatHub";
import * as signalR from "@microsoft/signalr";
import { MessageDTO } from "@shared/types/MessageDTO";
import { ReactionDTO } from "@shared/types/MessageDTO";
import { MessageRequestCreatedDto } from "@shared/types/MessageRequestCreatedDto";
import { MessageNotificationDTO } from "@shared/types/MessageNotificationDTO";
import { useMessageNotificationStore } from "@/store/useMessageNotificationStore";
import { GroupRequestCreatedDto } from "@shared/types/GroupRequestDTO";
import { GroupNotificationUpdateDTO } from "@shared/types/GroupNotificationUpdateDTO";
import { GroupDisbandedDto } from "@shared/types/GroupDisbandedDTO";
import { UserSummaryDTO } from "@shared/types/UserSummaryDTO";
import authServiceNative from "@/services/user/authServiceNative";

export function useChatHub(
  onReceiveMessage?: (message: MessageDTO) => void,
  onReceiveReaction?: (reaction: ReactionDTO, notification?: MessageNotificationDTO) => void,
  onRequestApproved?: (notification: MessageNotificationDTO) => void,
  onRequestCreated?: (data: MessageRequestCreatedDto) => void,
  onGroupRequestCreated?: (data: GroupRequestCreatedDto) => void,
  onGroupNotificationUpdated?: (data: GroupNotificationUpdateDTO) => void,
  onGroupDisbanded?: (data: GroupDisbandedDto) => void,
  onGroupParticipantsUpdated?: (conversationId: number) => void,
  onMessageDeleted?: (data: { conversationId: number; message: MessageDTO }) => void,
  onUserProfileUpdated?: (data: { 
    userId: number; 
    updatedFields: string[]; 
    updatedValues: Partial<UserSummaryDTO>; 
    updatedAt: string 
  }) => void,
  onUserBlockedUpdated?: (data: UserSummaryDTO) => void,
) {
  const messageRef = useRef(onReceiveMessage);
  const reactionRef = useRef<
    ((reaction: ReactionDTO, notification?: MessageNotificationDTO) => void) | undefined
  >(onReceiveReaction);
  const approvedRef = useRef<((notification: MessageNotificationDTO) => void) | null>(null);
  const createdRef = useRef(onRequestCreated);
  const groupRequestCreatedRef = useRef(onGroupRequestCreated);
  const groupNotificationUpdatedRef = useRef(onGroupNotificationUpdated);
  const groupDisbandedRef = useRef(onGroupDisbanded);
  const groupParticipantsUpdatedRef = useRef(onGroupParticipantsUpdated);
  const messageDeletedRef = useRef(onMessageDeleted);
  const userProfileUpdatedRef = useRef(onUserProfileUpdated);
  const userBlockedUpdatedRef = useRef(onUserBlockedUpdated);

  const connectionRef = useRef<signalR.HubConnection | null>(null);

  useEffect(() => { messageRef.current = onReceiveMessage }, [onReceiveMessage]);
  useEffect(() => { reactionRef.current = onReceiveReaction }, [onReceiveReaction]);
  useEffect(() => { approvedRef.current = onRequestApproved ?? null }, [onRequestApproved]);
  useEffect(() => { createdRef.current = onRequestCreated }, [onRequestCreated]);
  useEffect(() => { groupRequestCreatedRef.current = onGroupRequestCreated }, [onGroupRequestCreated]);
  useEffect(() => { groupNotificationUpdatedRef.current = onGroupNotificationUpdated }, [onGroupNotificationUpdated]);
  useEffect(() => { groupDisbandedRef.current = onGroupDisbanded }, [onGroupDisbanded]);
  useEffect(() => { groupParticipantsUpdatedRef.current = onGroupParticipantsUpdated }, [onGroupParticipantsUpdated]);
  useEffect(() => { messageDeletedRef.current = onMessageDeleted }, [onMessageDeleted]);
  useEffect(() => { userProfileUpdatedRef.current = onUserProfileUpdated }, [onUserProfileUpdated]);
  useEffect(() => { userBlockedUpdatedRef.current = onUserBlockedUpdated }, [onUserBlockedUpdated]);

  const setupEventListeners = (connection: signalR.HubConnection) => {
    console.log("🔧 Setting up SignalR event listeners...");

    connection.off("receivemessage");
    connection.off("receivereaction");
    connection.off("messagerequestapproved");
    connection.off("messagerequestcreated");
    connection.off("grouprequestcreated");
    connection.off("groupnotificationupdated");
    connection.off("groupdisbanded");
    connection.off("groupparticipantsupdated");
    connection.off("messagedeleted");
    connection.off("userprofileupdated");
    connection.off("userblockedupdated");

    connection.on("receivemessage", (message: MessageDTO) => {
      console.log("📨 receivemessage event triggered:", message.id);
      messageRef.current?.(message);
    });

    connection.on("receivereaction", (data) => {
      console.log("🎭 receivereaction event triggered:", data);
      const { reaction, notification } = data;
      if (reaction && 'messageId' in reaction && 'emoji' in reaction) {
        reactionRef.current?.(reaction, notification);
      } else {
        console.warn("❌ Ugyldig reaction-data mottatt:", data);
      }
    });

    connection.on("messagerequestapproved", (notification: MessageNotificationDTO) => {
      console.log("✅ messagerequestapproved event triggered:", notification);
      approvedRef.current?.(notification);
      useMessageNotificationStore.getState().upsertNotification(notification);
    });

    connection.on("messagerequestcreated", (data: MessageRequestCreatedDto) => {
      console.log("📨 messagerequestcreated event triggered:", data);
      const { notification } = data;
      if (notification && notification.type !== "MessageRequestApproved") {
        useMessageNotificationStore.getState().upsertNotification(notification);
      }
      createdRef.current?.(data);
    });

    connection.on("grouprequestcreated", (data: GroupRequestCreatedDto) => {
      console.log("👥 grouprequestcreated event triggered:", data);
      const { notification } = data;
      if (notification && notification.type !== "MessageRequestApproved") {
        useMessageNotificationStore.getState().upsertNotification(notification);
      }
      groupRequestCreatedRef.current?.(data);
    });

    connection.on("groupnotificationupdated", (data: GroupNotificationUpdateDTO) => {
      console.log("🔔 groupnotificationupdated event triggered:", data);
      groupNotificationUpdatedRef.current?.(data);
    });

    connection.on("groupdisbanded", (data: GroupDisbandedDto) => {
      console.log("💥 groupdisbanded event triggered:", data);
      groupDisbandedRef.current?.(data);
    });

    connection.on("groupparticipantsupdated", (data: { conversationId: number }) => {
      console.log("🔁 groupparticipantsupdated event triggered:", data);
      groupParticipantsUpdatedRef.current?.(data.conversationId);
    });

    connection.on("messagedeleted", (data: { conversationId: number; message: MessageDTO }) => {
      console.log("🗑️ messagedeleted event triggered:", data);
      messageDeletedRef.current?.(data);
    });

    connection.on("userprofileupdated", (data: { 
      userId: number; 
      updatedFields: string[]; 
      updatedValues: Partial<UserSummaryDTO>; 
      updatedAt: string 
    }) => {
      console.log("👤 userprofileupdated event triggered:", data);
      userProfileUpdatedRef.current?.(data);
    });

    connection.on("userblockedupdated", (data) => {
      console.log("🚫 userblockedupdated event triggered:", data);
      userBlockedUpdatedRef.current?.(data);
    });

    console.log("✅ All SignalR event listeners registered");
  };

  const startConnection = async () => {
    try {
      const token = await authServiceNative.getAccessToken();
      if (!token) {
        console.warn("⏳ Token not available yet, retrying in 1s...");
        setTimeout(startConnection, 1000);
        return;
      }

      if (!connectionRef.current) {
        console.log("🔧 Signal-R Creating new SignalR connection...");
        connectionRef.current = await createChatConnection();
        setupEventListeners(connectionRef.current);
        console.log("🔧 Signal-R Event listeners set up, attempting to start connection...");
      }

      if (connectionRef.current.state === signalR.HubConnectionState.Disconnected) {
        await connectionRef.current.start();
        console.log("✅ SignalR connected successfully");
        console.log("🔧 Verifying event listeners after connection...");
        setupEventListeners(connectionRef.current);
      } else {
        console.log(`ℹ️ Connection already in state: ${connectionRef.current.state}`);
      }
    } catch (err) {
      console.error("❌ SignalR Connection Error:", err);
      setTimeout(startConnection, 2000);
    }
  };

  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      console.log("📱 useChatHub - App state changed to:", nextAppState);
      if (nextAppState === 'active') {
        console.log("🔄 App became active, attempting to restart SignalR...");
        startConnection();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => { subscription?.remove(); };
  }, []);

  useEffect(() => {
    startConnection();
    return () => {
      if (connectionRef.current) {
        console.log("🛑 Cleaning up SignalR connection...");
        connectionRef.current.stop().catch(err => console.error("Error stopping connection:", err));
        connectionRef.current = null;
      }
    };
  }, []);
}
