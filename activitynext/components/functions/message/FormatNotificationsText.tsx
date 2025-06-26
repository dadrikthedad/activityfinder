import { MessageNotificationDTO } from "@/types/MessageNotificationDTO";
import React, { JSX } from 'react';
import { buildGroupEventText } from "./GroupEventTextBuilder";
import { HighlightedText } from "../HighlightedText";

export function formatNotificationText(n: MessageNotificationDTO): JSX.Element {
  const plainText = (text: string): JSX.Element => <span>{text}</span>;
  
  // Hvis samtalen er avslått, vis spesifikk tekst
  if (n.isConversationRejected) {
    switch (n.type) {
      case "MessageRequest":
      case 2:
        return plainText("message request (declined)");
      case "NewMessage":
      case 1:
        return plainText("sent message (conversation declined)");
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
     
      // 🆕 Bruk lagrede data fra notifikasjonen
      if (eventCount === 1 && n.latestGroupEventType && n.latestAffectedUsers) {
        return buildGroupEventText(
          n.latestGroupEventType,
          senderName,
          [], // Tom array for bakoverkompatibilitet
          n.latestAffectedUsers,
          groupName
        );
      } else if (eventCount > 1) {
        // For flere hendelser: vis count
        return (
          <span>
            There are {eventCount} new updates in <HighlightedText>{groupName}</HighlightedText>
          </span>
        );
      } else {
        // Fallback
        return (
          <span>
            New update in <HighlightedText>{groupName}</HighlightedText>
          </span>
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