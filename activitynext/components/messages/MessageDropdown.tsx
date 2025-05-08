// Dropdownen som finnes i navbaren, inneholder ConversatonList.tsx, MessageList.tsx og MessageInput.tsx. Sender samtaleid mellom disse samt at den bruker fra navbaren
"use client";

import MessageList from "./MessageList";
import { useState } from "react";
import ConversationList from "./ConversationList";
import { UserSummaryDTO } from "@/types/UserSummaryDTO";
import MessageInput from "./MessageInput";

interface MessageDropdownProps {
    currentUser: UserSummaryDTO | null;
  }

  export default function MessageDropdown({ currentUser }: MessageDropdownProps) {
    const [selectedConversationId, setSelectedConversationId] = useState<number | null>(null); // Midlertidig hardkodet

  return (
    <div className="absolute right-0 top-12 bg-white dark:bg-[#1e2122] text-black dark:text-white rounded-lg shadow-md p-4 z-10 max-w-[90vw] w-[800px] border-2 border-[#1C6B1C] overflow-hidden">
      <h4 className="text-lg font-semibold mb-4 text-center">Messages</h4>

      <div className="flex gap-4">
        {/* Samtalevalg til venstre */}
        <ConversationList
          selectedId={selectedConversationId}
          onSelect={(id) => setSelectedConversationId(id)}
          currentUser={currentUser}
        />


        {/* Meldingsvisning til høyre */}
        <div className="flex-1 flex flex-col h-[500px] min-h-[300px]"> {/* Sett gjerne høyde her */}
            {selectedConversationId ? (
                <>
                    <MessageList
                    conversationId={selectedConversationId}
                    currentUser={currentUser}
                    />
                <div className="shrink-0">
                    <MessageInput
                    conversationId={selectedConversationId}
                    receiverId={undefined}
                    onMessageSent={(message) => {
                        console.log("Ny melding sendt:", message);
                    }}
                    />
                </div>
                </>
            ) : (
                <div className="text-center text-gray-500 flex-1 flex items-center justify-center">
                Select a conversation to view messages
                </div>
            )}
            </div>
      </div>
    </div>
  );
}