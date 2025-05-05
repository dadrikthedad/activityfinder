"use client";
import ChatWindow from "@/components/messages/ChatWindow";

export default function ChatPage() {
  return (
    <div className="px-6 py-8">
      <ChatWindow showSidebar />
    </div>
  );
}