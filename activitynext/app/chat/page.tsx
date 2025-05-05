"use client";
import ChatWindow from "@/components/messages/ChatWindow";
import { useChatState } from "@/hooks/conversations/useChatState";
import { useChatPageState } from "@/hooks/conversations/useChatPageState";

export default function ChatPage() {
  const pageState = useChatPageState();
  const chat = useChatState({ ...pageState, autoSelectFirstConversation: true });
  return (
    <div className="px-6 py-8">
      <ChatWindow showSidebar {...chat} />
    </div>
  );
}