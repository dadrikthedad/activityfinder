// Samtaler som vises i MessageDropdownen i navbaren
"use client";

import { usePaginatedConversations } from "@/hooks/messages/getMyConversations";
import { ConversationDTO } from "@/types/ConversationDTO";
import { ConversationListItem } from "./ConversationListUserCard";
import { UserSummaryDTO } from "@/types/UserSummaryDTO";
import { useChatStore } from "@/store/useChatStore";
import { useRef, useEffect } from "react";



interface Props {
  selectedId: number | null;
  onSelect: (id: number) => void;
  currentUser: UserSummaryDTO | null;
  onShowUserPopover: (user: UserSummaryDTO, pos: { x: number; y: number }) => void; // 👈 Ny prop
}

export default function ConversationList({ selectedId, onSelect, currentUser, onShowUserPopover }: Props) {
    const { conversations: storeConversations } = useChatStore(); // Her lagrer vi samtaler i store, så vi slipper å loade hver gang
    const { loadMore, loading, hasMore } = usePaginatedConversations(); // Henter samtaler med paginering fra usePaginatedConversations MÅ IMPLIMENTERE LOGIKK RUNDT DETTE TODO
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const getOtherUser = (conv: ConversationDTO): UserSummaryDTO | undefined => {
      return conv.participants.find(p => p.id !== currentUser?.id);
    };

    // Håndtere scrolling og paginering
    const handleScroll = () => {
      const container = scrollContainerRef.current;
      if (!container || loading || !hasMore) return;

      const { scrollTop, scrollHeight, clientHeight } = container;
      if (scrollTop + clientHeight >= scrollHeight - 50) {
        loadMore();
      }
    };

    // Trenger å sjekke at denne funker
    useEffect(() => {
      const container = scrollContainerRef.current;
      if (
        container &&
        container.scrollHeight <= container.clientHeight &&
        !loading &&
        hasMore
      ) {
        loadMore();
      }
    }, [storeConversations, loadMore, loading, hasMore]);

  
    return (
      <div 
      ref={scrollContainerRef}
      onScroll={handleScroll}
      className="w-full h-full overflow-y-auto overflow-x-hidden custom-scrollbar">{storeConversations.length === 0 && loading ? (
        <div className="flex justify-center items-center h-full">
          <div className="animate-spin rounded-full h-10 w-10 border-4 border-t-green-600 border-gray-200"></div>
        </div>
      ) : (
        <>
          <ul className="space-y-2 px-2">
            {storeConversations.map((conv) => {
              const isGroup = conv.isGroup;
              const otherUser = getOtherUser(conv);

              if (isGroup) {
                return (
                  <ConversationListItem
                    key={conv.id}
                    user={{
                      id: conv.id, // unik identifikator, selv om det ikke er en faktisk bruker
                      fullName: conv.groupName || "Group Chat",
                      profileImageUrl: "/default-group.png", // eller conv.groupImageUrl
                    }}
                    selected={selectedId === conv.id}
                    isPendingApproval={conv.isPendingApproval}
                    onClick={() => onSelect(conv.id)}
                    onShowUserPopover={() => {}} // tom fordi det ikke gir mening
                  />
                );
              }

              if (!otherUser) return null;

              return (
                <ConversationListItem
                  key={conv.id}
                  user={otherUser}
                  selected={selectedId === conv.id}
                  isPendingApproval={conv.isPendingApproval}
                  onClick={() => onSelect(conv.id)}
                  onShowUserPopover={onShowUserPopover}
                />
              );
            })}
          </ul>

          {loading && (
            <div className="flex justify-center my-4">
              <div className="animate-spin rounded-full h-8 w-8 border-4 border-t-green-600 border-gray-200"></div>
            </div>
          )}
        </>
      )}

            </div>
    );
  }
