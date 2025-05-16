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

    // Henter navnet
    const getDisplayName = (conv: ConversationDTO): string => {
        if (conv.isGroup) return conv.groupName || "Group Chat";
        const other = conv.participants.find(p => p.id !== currentUser?.id);
        return other?.fullName || "Unknown user";
    };
  
    const getProfileImage = (conv: ConversationDTO): string => {
        if (conv.isGroup) return "/default-group.png"; // Bruk bildet ditt her
        const other = conv.participants.find(p => p.id !== currentUser?.id);
        return other?.profileImageUrl || "/default-avatar.png";
    };

  
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
            {storeConversations.map((conv: ConversationDTO) => (
              <ConversationListItem
                key={conv.id}
                id={conv.id}
                name={getDisplayName(conv)}
                imageUrl={getProfileImage(conv)}
                selected={selectedId === conv.id}
                isPendingApproval={conv.isPendingApproval}
                onClick={(id) => onSelect(id as number)}
                onShowUserPopover={onShowUserPopover} 
              />
            ))}
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
