// Samtaler som vises i MessageDropdownen i navbaren
"use client";

import { usePaginatedConversations } from "@/hooks/messages/getMyConversations";
import { ConversationDTO } from "@/types/ConversationDTO";
import { ConversationListItem } from "./ConversationListUserCard";
import { UserSummaryDTO } from "@/types/UserSummaryDTO";
import { useChatStore } from "@/store/useChatStore";
import { useEffect } from "react";
import Spinner from "@/components/common/Spinner";

interface Props {
  selectedId: number | null;
  onSelect: (id: number) => void;
  currentUser: UserSummaryDTO | null;
}

export default function ConversationList({ selectedId, onSelect, currentUser }: Props) {
    const { conversations: storeConversations, setConversations } = useChatStore(); // Her lagrer vi samtaler i store, så vi slipper å loade hver gang
    const { conversations: paginatedConversations, loadMore, loading, hasMore } = usePaginatedConversations(); // Henter samtaler med paginering fra usePaginatedConversations MÅ IMPLIMENTERE LOGIKK RUNDT DETTE TODO
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

    // Hent samtaler kun én gang hvis ikke lagret
    useEffect(() => {
      if (storeConversations.length === 0 && paginatedConversations.length > 0) {
        const merged = [
          ...paginatedConversations,
          ...storeConversations.filter(
            s => !paginatedConversations.some(p => p.id === s.id)
          ),
        ];
        setConversations(merged);
      }
    }, [storeConversations, paginatedConversations, setConversations]);
  
    return (
      <div className="w-60 border-gray-300 dark:border-gray-600 overflow-y-auto overflow-x-hidden max-h-[480px] custom-scrollbar">
  
              {loading && storeConversations.length === 0 ? (
        <Spinner text="Grabbing conversations.." />
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
                onClick={(id) => onSelect(id as number)}
              />
            ))}
          </ul>

          {hasMore && (
            <div className="text-center my-3">
              <button
                onClick={loadMore}
                disabled={loading}
                className="text-sm px-3 py-1 bg-[#1C6B1C] hover:bg-[#145214] text-white rounded"
              >
                {loading ? "Loading..." : "Load more"}
              </button>
            </div>
          )}
        </>
      )}
      </div>
    );
  }
