// utils/notifications/buildGroupEventTextNative.tsx
import { GroupEventType } from "@shared/types/GroupNotificationUpdateDTO";
import { UserSummaryDTO } from "@shared/types/UserSummaryDTO";
import React from 'react';
import { Text, TextStyle } from 'react-native';
import { formatUserListNative } from "./NotificationsUserListFormatterNative";

// React Native versjon av HighlightedText
interface HighlightedTextProps {
  children: React.ReactNode;
  style?: TextStyle;
}

const HighlightedText: React.FC<HighlightedTextProps> = ({ children, style }) => (
  <Text style={[{ fontWeight: 'bold', color: '#1C6B1C' }, style]}>
    {children}
  </Text>
);

export const buildGroupEventTextNative = (
  eventType: GroupEventType | string,
  senderName: string,
  affectedUserNames: string[],
  affectedUsers: UserSummaryDTO[],
  groupName: string,
  baseStyle?: TextStyle
): React.ReactElement => {
  
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
        <Text style={baseStyle}>
          {sender} invited {formatUserListNative(affectedUsers)} to {group}
        </Text>
      );
     
    case GroupEventType.MemberAccepted:
      if (affectedUsers?.length > 0 || affectedUserNames?.length > 0) {
        return (
          <Text style={baseStyle}>
            {formatUserListNative(affectedUsers)} joined {group}
          </Text>
        );
      }
      return (
        <Text style={baseStyle}>
          {sender} joined {group}
        </Text>
      );
     
    case GroupEventType.MemberLeft:
      if (affectedUsers?.length > 0 || affectedUserNames?.length > 0) {
        return (
          <Text style={baseStyle}>
            {formatUserListNative(affectedUsers)} left {group}
          </Text>
        );
      }
      return (
        <Text style={baseStyle}>
          {sender} left {group}
        </Text>
      );
     
    case GroupEventType.MemberRemoved:
      return (
        <Text style={baseStyle}>
          {sender} removed {formatUserListNative(affectedUsers)} from {group}
        </Text>
      );
     
    case GroupEventType.GroupNameChanged:
      return (
        <Text style={baseStyle}>
          {sender} changed the name of {group}
        </Text>
      );
     
    case GroupEventType.GroupImageChanged:
      return (
        <Text style={baseStyle}>
          {sender} changed the image of {group}
        </Text>
      );
     
    case GroupEventType.GroupCreated:
      return (
        <Text style={baseStyle}>
          {sender} created {group}
        </Text>
      );
     
    default:
      return (
        <Text style={baseStyle}>
          {sender} performed an action in {group}
        </Text>
      );
  }
};