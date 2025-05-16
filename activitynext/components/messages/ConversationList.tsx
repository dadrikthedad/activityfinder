// Samtaler som vises i MessageDropdownen i navbaren
"use client";

import { usePaginatedConversations } from "@/hooks/messages/getMyConversations";
import { ConversationDTO } from "@/types/ConversationDTO";
import { ConversationListItem } from "./ConversationListUserCard";
import { UserSummaryDTO } from "@/types/UserSummaryDTO";
import { useChatStore } from "@/store/useChatStore";


interface Props {
  selectedId: number | null;
  onSelect: (id: number) => void;
  currentUser: UserSummaryDTO | null;
}

export default function ConversationList({ selectedId, onSelect, currentUser }: Props) {
    const { conversations: storeConversations } = useChatStore(); // Her lagrer vi samtaler i store, så vi slipper å loade hver gang
    const { loadMore, loading, hasMore } = usePaginatedConversations(); // Henter samtaler med paginering fra usePaginatedConversations MÅ IMPLIMENTERE LOGIKK RUNDT DETTE TODO
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
      <div className="w-full h-full overflow-y-auto overflow-x-hidden custom-scrollbar">
  
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
      </div>
    );
  }
