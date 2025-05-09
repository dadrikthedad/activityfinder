// Samtaler som vises i MessageDropdownen i navbaren
"use client";

import { usePaginatedConversations } from "@/hooks/messages/getMyConversations";
import { ConversationDTO } from "@/types/ConversationDTO";
import Image from "next/image";
import { UserSummaryDTO } from "@/types/UserSummaryDTO";
import { useChatStore } from "@/store/useChatStore";
import { useEffect } from "react";

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
        setConversations(paginatedConversations);
      }
    }, [storeConversations, paginatedConversations, setConversations]);
  
    return (
      <div className="w-60 border-r border-gray-300 dark:border-gray-600 overflow-y-auto max-h-[480px]">
        <h4 className="text-lg font-semibold p-4 text-center">Conversations</h4>
  
        <ul className="space-y-2 px-2">
        {storeConversations.map((conv: ConversationDTO) => (
            <li
              key={conv.id}
              onClick={() => onSelect(conv.id)}
              className={`flex items-center gap-3 p-2 rounded-md cursor-pointer transition ${
                selectedId === conv.id
                  ? "bg-[#e0f2e0] dark:bg-[#2c2f30]"
                  : "hover:bg-gray-100 dark:hover:bg-gray-700"
              }`}
            >
              <Image
                src={getProfileImage(conv)}
                alt={getDisplayName(conv)}
                width={40}
                height={40}
                className="rounded-full object-cover w-10 h-10"
              />
              <span className="text-sm font-medium truncate">{getDisplayName(conv)}</span>
            </li>
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
