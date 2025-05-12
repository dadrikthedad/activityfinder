"use client"

import PendingMessageList from "@/components/messages/PendingMessageList";


export default function ChatPage() {
  return (
    <div className="px-6 py-8">
      <h2 className="text-xl font-semibold mb-4">Meldingsforespørsler</h2>
      <PendingMessageList />
    </div>
  );
}