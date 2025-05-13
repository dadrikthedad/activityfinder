// Dropdownen som finnes i navbaren, inneholder ConversatonList.tsx, MessageList.tsx og MessageInput.tsx. Sender samtaleid mellom disse samt at den bruker fra navbaren
"use client";

import MessageList from "./MessageList";
import { useState } from "react";
import ConversationList from "./ConversationList";
import { UserSummaryDTO } from "@/types/UserSummaryDTO";
import MessageInput from "./MessageInput";
import { useChatStore } from "@/store/useChatStore";
import PendingRequestsList from "./PendingMessageList";
import { useModal } from "@/context/ModalContext";
import NewMessageModal from "./NewMessageModal";
import ProfileNavButton from "../settings/ProfileNavButton";

interface MessageDropdownProps {
    currentUser: UserSummaryDTO | null;
    popoverRef: React.RefObject<HTMLDivElement | null>
    onCloseDropdown: () => void;
  }

  export default function MessageDropdown({ currentUser, popoverRef, onCloseDropdown }: MessageDropdownProps) {
    const {
      currentConversationId,
      setCurrentConversationId,
    } = useChatStore();
    
  const [selectedConversationId, setSelectedConversationId] = useState<number | null>(currentConversationId);

  // Oppdater state lokalt + globalt
    const handleSelect = (id: number) => {
      setSelectedConversationId(id);
      setCurrentConversationId(id);
      console.log("📩 handleSelect kalles med ID:", id);
    };

    const { showModal } = useModal(); // Viser ny meldingsmodalen
    

  return (
    <div className="absolute right-0 top-12 bg-white dark:bg-[#1e2122] text-black dark:text-white rounded-lg shadow-md p-4 z-10 max-w-[90vw] w-[800px] border-2 border-[#1C6B1C] overflow-hidden">
      <h4 className="text-lg font-semibold mb-4 text-center">Messages</h4>

      <div className="flex gap-4">
        {/* Meldingsforespørsler + samtaler til venstre */}
          <div className="w-[250px] overflow-y-auto max-h-[500px]">
            <h4 className="text-sm font-medium mb-2">Forespørsler</h4>
            <PendingRequestsList limit={3} onSelectConversation={handleSelect} showMoreLink={true} />

            <hr className="my-2" />
            <ConversationList
              selectedId={selectedConversationId}
              onSelect={handleSelect}
              currentUser={currentUser}
            />
          </div>

          <div className="mt-4 flex justify-center">
            <ProfileNavButton
              text="Ny melding"
              variant="small"
              onClick={() => showModal(<NewMessageModal/>)}
            />
          </div>


        {/* Meldingsvisning til høyre */}
        <div className="flex-1 flex flex-col h-[500px] min-h-[300px]"> {/* Sett gjerne høyde her */}
            {selectedConversationId ? (
                <>
                    <MessageList
                    conversationId={selectedConversationId}
                    currentUser={currentUser}
                    popoverRef={popoverRef}
                    onCloseDropdown={onCloseDropdown}
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