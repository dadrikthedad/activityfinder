// Dropdownen som finnes i navbaren, inneholder ConversatonList.tsx, MessageList.tsx og MessageInput.tsx. Sender samtaleid mellom disse samt at den bruker fra navbaren
"use client";

import MessageList from "./MessageList";
import ConversationList from "./ConversationList";
import { UserSummaryDTO } from "@/types/UserSummaryDTO";
import MessageInput from "./MessageInput";
import { useChatStore } from "@/store/useChatStore";
import PendingRequestsList from "./PendingMessageList";
import { useModal } from "@/context/ModalContext";
import NewMessageModal from "./NewMessageModal";
import ProfileNavButton from "../settings/ProfileNavButton";
import { useEffect } from "react";
import { usePendingMessageRequests } from "@/hooks/messages/usePendingMessageRequests";


interface MessageDropdownProps {
    currentUser: UserSummaryDTO | null;
    popoverRef: React.RefObject<HTMLDivElement | null>
    onCloseDropdown: () => void;
  }

  export default function MessageDropdown({ currentUser, popoverRef, onCloseDropdown }: MessageDropdownProps) {
  const { currentConversationId, setCurrentConversationId } = useChatStore();
  const { requests: pending, loading: pendingLoading } = usePendingMessageRequests();
  const currentConversation = useChatStore((state) =>
    state.conversations.find((c) => c.id === currentConversationId)
  );
  const pendingLockedConversationId = useChatStore((state) => state.pendingLockedConversationId);

  // Oppdater state lokalt + globalt
    const handleSelect = (id: number) => {
      const pendingRequest = pending.find((r) => r.conversationId === id);
      if (pendingRequest) {
        useChatStore.getState().setPendingLockedConversationId(id);
      } else {
        useChatStore.getState().setPendingLockedConversationId(null);
      }
      setCurrentConversationId(id);
    };

    // Rydd bare når man bytter til en annen samtale
    useEffect(() => {
      return () => {
        if (currentConversationId !== null) {
          const state = useChatStore.getState();
          const live = state.liveMessages[currentConversationId] ?? [];
          const cached = state.cachedMessages[currentConversationId] ?? [];

          const combined = [
            ...cached,
            ...live.filter(m => !cached.some(c => c.id === m.id))
          ];

          console.log("💾 Cacher meldinger før unmount", {
            conversationId: currentConversationId,
            cachedCount: cached.length,
            liveCount: live.length,
            newTotal: combined.length
          });

          // 👉 Lagre dem før vi tømmer
          state.setCachedMessages(currentConversationId, combined);
          state.clearLiveMessages(currentConversationId);
        }
      };
    }, [currentConversationId]);

    console.log("🧭 Bytter samtale til", currentConversationId);

    const { showModal } = useModal(); // Viser ny meldingsmodalen
    

  return (
    <div className="absolute right-0 top-12 bg-white dark:bg-[#1e2122] text-black dark:text-white rounded-lg shadow-md p-4 z-10 max-w-[100vw] w-[1200px] border-2 border-[#1C6B1C] h-[600px] overflow-hidden resize">
      <div className="flex h-full">
        {/* Venstre kolonne */}
        <div className="w-[250px] flex flex-col overflow-hidden">
          <div className="custom-scrollbar flex-1">
            {(pendingLoading || pending.length > 0) && (
              <>
                <PendingRequestsList limit={2} onSelectConversation={handleSelect} showMoreLink={true} />
                <hr className="my-2 w-3/4 mx-auto border-y border-gray-300 dark:border-[#1C6B1C]" />
              </>
            )}

            <ConversationList
              selectedId={currentConversationId}
              onSelect={handleSelect}
              currentUser={currentUser}
            />
          </div>

          <div className="p-4 shrink-0">
            <ProfileNavButton
              text="✚"
              variant="iconOnly"
              onClick={() => showModal(<NewMessageModal />)}
            />
          </div>
        </div>

        {/* Høyre kolonne */}
        <div className="flex-1 flex flex-col px-4 h-full">
          {currentConversation?.isPendingApproval && currentConversationId !== pendingLockedConversationId && (
            <div className="bg-yellow-300 border border-yellow-400 text-yellow-800 px-4 py-2 mb-2 rounded text-sm text-center">
              Message request sent. You can send a maximum of 5 messages the receiver will be able to see.
            </div>
          )}

          {currentConversationId === pendingLockedConversationId && (
            <div className="bg-yellow-300 border border-yellow-400 text-yellow-800 px-4 py-2 mb-2 rounded text-sm text-center">
                Approve the conversation to start sending messages.
            </div>
          )}

          {currentConversationId ? (
            <>
              <div className="flex-1 min-h-0 overflow-auto">
                <MessageList
                  currentUser={currentUser}
                  popoverRef={popoverRef}
                  onCloseDropdown={onCloseDropdown}
                />
              </div>

              <div className="shrink-0 mt-2">
                <MessageInput
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