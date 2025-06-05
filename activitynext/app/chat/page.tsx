"use client";
import { useEffect } from "react";
import { showNotificationToast } from "@/components/toast/Toast";
import { NotificationType } from "@/types/MessageNotificationDTO";

export default function ChatPage() {

  useEffect(() => {
  const timeout = setTimeout(() => {
    showNotificationToast({
      senderName: "Demo Bruker",
      messagePreview: "Se hvordan denne toasten ser ut",
      conversationId: 42,
      type: NotificationType.MessageReaction,
      reactionEmoji: "🔥",
    });
  }, 100); // forsink 100ms

  return () => clearTimeout(timeout);
}, []);
  
  return (
    <div className="px-6 py-8">
      <h2 className="text-xl font-semibold mb-4">Meldingsforespørsler</h2>
    </div>
  );
}