import { GroupEventType } from "@/types/GroupNotificationUpdateDTO";
import { UserSummaryDTO } from "@/types/UserSummaryDTO";
import React, { JSX } from 'react';
import { formatUserList } from "./NotificationsUserListFormatter";
import { HighlightedText } from "./HighlightedText";

export const buildGroupEventText = (
  eventType: GroupEventType | string,
  senderName: string,
  affectedUserNames: string[],
  affectedUsers: UserSummaryDTO[], // 🔧 Lagt til riktig typing
  groupName: string
): JSX.Element => {
  const sender = <HighlightedText>{senderName}</HighlightedText>;
  const group = <HighlightedText>{groupName}</HighlightedText>;
 
  // Konverter string til enum hvis nødvendig
  let eventTypeEnum: GroupEventType;
  if (typeof eventType === 'string') {
    eventTypeEnum = GroupEventType[eventType as keyof typeof GroupEventType];
  } else {
    eventTypeEnum = eventType;
  }
 
  switch (eventTypeEnum) {
    case GroupEventType.MemberInvited:
      return (
        <span>
          {sender} invited {formatUserList(affectedUsers)} to {group}
        </span>
      );
     
    case GroupEventType.MemberAccepted:
      if (affectedUsers?.length > 0 || affectedUserNames?.length > 0) {
        return (
          <span>
            {formatUserList(affectedUsers)} joined {group}
          </span>
        );
      }
      return <span>{sender} joined {group}</span>;
     
    case GroupEventType.MemberLeft:
      if (affectedUsers?.length > 0 || affectedUserNames?.length > 0) {
        return (
          <span>
            {formatUserList(affectedUsers)} left {group}
          </span>
        );
      }
      return <span>{sender} left {group}</span>;
     
    case GroupEventType.MemberRemoved:
      return (
        <span>
          {sender} removed {formatUserList(affectedUsers)} from {group}
        </span>
      );
     
    case GroupEventType.GroupNameChanged:
      return <span>{sender} changed the name of {group}</span>;
     
    case GroupEventType.GroupImageChanged:
      return <span>{sender} changed the image of {group}</span>;
     
    case GroupEventType.GroupCreated:
      return <span>{sender} created {group}</span>;
     
    default:
      return <span>{sender} performed an action in {group}</span>;
  }
};