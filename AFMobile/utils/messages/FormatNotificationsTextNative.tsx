// utils/notifications/formatNotificationTextNative.tsx
import { MessageNotificationDTO } from "@shared/types/MessageNotificationDTO";
import React from 'react';
import { Text, TextStyle } from 'react-native';
import { buildGroupEventTextNative } from "./GroupEventTextBuilderNative";


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

export function formatNotificationTextNative(
  n: MessageNotificationDTO,
  baseStyle?: TextStyle
): React.ReactElement {
  
  const plainText = (text: string): React.ReactElement => (
    <Text style={baseStyle}>{text}</Text>
  );
 
  // Hvis samtalen er avslått, vis spesifikk tekst
  if (n.isConversationRejected) {
    switch (n.type) {
      case "GroupRequest":
      case 5:
        const groupName = n.groupName || "a group";
        return (
          <Text style={baseStyle}>
            invited you to <HighlightedText>{groupName}</HighlightedText> (conversation declined)
          </Text>
        );
        
      case "GroupEvent":
      case 8:
        const grpName = n.groupName || "a group";
        return (
          <Text style={baseStyle}>
            You have left <HighlightedText>{grpName}</HighlightedText>
          </Text>
        );
        
      case "GroupDisbanded":
      case 9:
        const disbandedGroupName = n.groupName || "a group";
        return (
          <Text style={baseStyle}>
            <HighlightedText>{disbandedGroupName}</HighlightedText> was disbanded
          </Text>
        );
        
      case "MessageRequest":
      case 2:
        return plainText("message request (declined)");
        
      case "NewMessage":
      case 1:
        if (n.groupName) {
          return (
            <Text style={baseStyle}>
              You have left <HighlightedText>{n.groupName}</HighlightedText>
            </Text>
          );
        }
        return plainText("message request (declined)");
        
      default:
        return plainText("notification (conversation declined)");
    }
  }
 
  switch (n.type) {
    case "NewMessage":
    case 1:
      return plainText(n.messagePreview ?? "sent you a message");
     
    case "MessageRequest":
    case 2:
      return plainText("requested to message you");
     
    case "MessageRequestApproved":
    case 3:
      return plainText(n.messagePreview ?? "approved your message request");
     
    case "GroupRequest":
    case 5:
      return plainText(n.messagePreview ?? "invited you to join a group");
     
    case "GroupRequestApproved":
    case 6:
      return plainText(n.messagePreview ?? "joined your group");
     
    case "GroupEvent":
    case 8:
      const eventCount = n.messageCount ?? n.eventCount ?? 1;
      const groupName = n.groupName || "a group";
      const senderName = n.senderName || "Someone";
     
      if (eventCount === 1 && n.latestGroupEventType && n.latestAffectedUsers) {
        // Dette krever at buildGroupEventText også er konvertert til React Native
        return buildGroupEventTextNative(
          n.latestGroupEventType,
          senderName,
          [],
          n.latestAffectedUsers || [],
          groupName,
          baseStyle
        );
      } else if (eventCount > 1) {
        return (
          <Text style={baseStyle}>
            There are {eventCount} new updates in <HighlightedText>{groupName}</HighlightedText>
          </Text>
        );
      } else {
        return (
          <Text style={baseStyle}>
            New update in <HighlightedText>{groupName}</HighlightedText>
          </Text>
        );
      }
     
    case "MessageReaction":
    case 4:
      if (n.reactionEmoji) {
        const preview = n.messagePreview ? ` on "${n.messagePreview}"` : "";
        return plainText(`reacted with ${n.reactionEmoji}${preview}`);
      }
      return plainText("reacted to your message");
     
    default:
      return plainText(n.messagePreview ?? "You have a notification");
  }
}

// Denne funksjonen er nå flyttet til egen fil: buildGroupEventTextNative.tsx