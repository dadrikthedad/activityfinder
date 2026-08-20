import { useEffect, useRef } from "react";
import { createChatConnection } from "@/utils/signalr/chatHub";
import * as signalR from "@microsoft/signalr";
import { MessageDTO, ReactionDTO } from "@shared/types/MessageDTO";
import { MessageRequestCreatedDto } from "@shared/types/MessageRequestCreatedDto";
import { MessageNotificationDTO } from "@shared/types/MessageNotificationDTO";
import { useMessageNotificationStore } from "@/store/useMessageNotificationStore";
import { GroupRequestCreatedDto } from "@shared/types/GroupRequestDTO";
import { GroupNotificationUpdateDTO } from "@shared/types/GroupNotificationUpdateDTO";
import { GroupDisbandedDto } from "@shared/types/GroupDisbandedDTO";
import { UserSummaryDTO } from "@shared/types/UserSummaryDTO";

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
    userId: string;
    updatedFields: string[];
    updatedValues: Partial<UserSummaryDTO>;
    updatedAt: string;
  }) => void,
  onUserBlockedUpdated?: (data: UserSummaryDTO) => void,
) {
  const messageRef = useRef(onReceiveMessage);
  const reactionRef = useRef(onReceiveReaction);
  const approvedRef = useRef(onRequestApproved);
  const createdRef = useRef(onRequestCreated);
  const groupRequestCreatedRef = useRef(onGroupRequestCreated);
  const groupNotificationUpdatedRef = useRef(onGroupNotificationUpdated);
  const groupDisbandedRef = useRef(onGroupDisbanded);
  const groupParticipantsUpdatedRef = useRef(onGroupParticipantsUpdated);
  const messageDeletedRef = useRef(onMessageDeleted);
  const userProfileUpdatedRef = useRef(onUserProfileUpdated);
  const userBlockedUpdatedRef = useRef(onUserBlockedUpdated);

  useEffect(() => { messageRef.current = onReceiveMessage; }, [onReceiveMessage]);
  useEffect(() => { reactionRef.current = onReceiveReaction; }, [onReceiveReaction]);
  useEffect(() => { approvedRef.current = onRequestApproved; }, [onRequestApproved]);
  useEffect(() => { createdRef.current = onRequestCreated; }, [onRequestCreated]);
  useEffect(() => { groupRequestCreatedRef.current = onGroupRequestCreated; }, [onGroupRequestCreated]);
  useEffect(() => { groupNotificationUpdatedRef.current = onGroupNotificationUpdated; }, [onGroupNotificationUpdated]);
  useEffect(() => { groupDisbandedRef.current = onGroupDisbanded; }, [onGroupDisbanded]);
  useEffect(() => { groupParticipantsUpdatedRef.current = onGroupParticipantsUpdated; }, [onGroupParticipantsUpdated]);
  useEffect(() => { messageDeletedRef.current = onMessageDeleted; }, [onMessageDeleted]);
  useEffect(() => { userProfileUpdatedRef.current = onUserProfileUpdated; }, [onUserProfileUpdated]);
  useEffect(() => { userBlockedUpdatedRef.current = onUserBlockedUpdated; }, [onUserBlockedUpdated]);

  useEffect(() => {
    let connection: signalR.HubConnection | null = null;

    const registerListeners = (conn: signalR.HubConnection) => {
      conn.off("receivemessage");
      conn.off("receivereaction");
      conn.off("messagerequestapproved");
      conn.off("messagerequestcreated");
      conn.off("grouprequestcreated");
      conn.off("groupnotificationupdated");
      conn.off("groupdisbanded");
      conn.off("groupparticipantsupdated");
      conn.off("messagedeleted");
      conn.off("userprofileupdated");
      conn.off("userblockedupdated");

      conn.on("receivemessage", (message: MessageDTO) => {
        messageRef.current?.(message);
      });

      conn.on("receivereaction", (data) => {
        const { reaction, notification } = data;
        if (reaction && 'messageId' in reaction && 'emoji' in reaction) {
          reactionRef.current?.(reaction, notification);
        }
      });

      conn.on("messagerequestapproved", (notification: MessageNotificationDTO) => {
        approvedRef.current?.(notification);
        useMessageNotificationStore.getState().upsertNotification(notification);
      });

      conn.on("messagerequestcreated", (data: MessageRequestCreatedDto) => {
        const { notification } = data;
        if (notification && notification.type !== "MessageRequestApproved") {
          useMessageNotificationStore.getState().upsertNotification(notification);
        }
        createdRef.current?.(data);
      });

      conn.on("grouprequestcreated", (data: GroupRequestCreatedDto) => {
        const { notification } = data;
        if (notification && notification.type !== "MessageRequestApproved") {
          useMessageNotificationStore.getState().upsertNotification(notification);
        }
        groupRequestCreatedRef.current?.(data);
      });

      conn.on("groupnotificationupdated", (data: GroupNotificationUpdateDTO) => {
        groupNotificationUpdatedRef.current?.(data);
      });

      conn.on("groupdisbanded", (data: GroupDisbandedDto) => {
        groupDisbandedRef.current?.(data);
      });

      conn.on("groupparticipantsupdated", (data: { conversationId: number }) => {
        groupParticipantsUpdatedRef.current?.(data.conversationId);
      });

      conn.on("messagedeleted", (data: { conversationId: number; message: MessageDTO }) => {
        messageDeletedRef.current?.(data);
      });

      conn.on("userprofileupdated", (data: {
        userId: string;
        updatedFields: string[];
        updatedValues: Partial<UserSummaryDTO>;
        updatedAt: string;
      }) => {
        userProfileUpdatedRef.current?.(data);
      });

      conn.on("userblockedupdated", (data: UserSummaryDTO) => {
        userBlockedUpdatedRef.current?.(data);
      });
    };

    const setup = async () => {
      // Henter eller oppretter singleton-tilkoblingen som eies av chatHub.ts
      connection = await createChatConnection();
      registerListeners(connection);
    };

    setup();

    return () => {
      if (connection) {
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
      }
    };
  }, []);
}
