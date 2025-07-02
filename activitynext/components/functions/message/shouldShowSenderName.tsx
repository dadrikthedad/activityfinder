import { MessageNotificationDTO } from "@/types/MessageNotificationDTO";
export function shouldShowSenderName(n: MessageNotificationDTO): boolean {

    if (n.type === "GroupEvent" || n.type === 8) {
      return false;
    }

  if (n.type === "NewMessage" || n.type === 1) {
    // For grupper: kun vis sender-navn hvis det er 1 melding
    if (n.groupName) {
      return (n.messageCount ?? 1) === 1;
    }
    // For private: alltid vis sender-navn
    return true;
  }
  // For andre typer: alltid vis sender-navn
  return true;
}
