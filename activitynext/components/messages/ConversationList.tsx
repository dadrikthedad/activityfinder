// Samtaler som vises i MessageDropdownen i navbaren
"use client";

import { usePaginatedConversations } from "@/hooks/messages/getMyConversations";
import { ConversationDTO } from "@shared/types/ConversationDTO";
import { ConversationListItem } from "./ConversationListUserCard";
import { UserSummaryDTO } from "@shared/types/UserSummaryDTO";
import { useChatStore } from "@/store/useChatStore";
import { useRef, useEffect, useState } from "react";
import { take } from "@/hooks/messages/getMyConversations";

interface Props {
  selectedId: number | null;
  onSelect: (id: number) => void;
  currentUser: UserSummaryDTO | null;
  conversations?: ConversationDTO[];
  // FJERNET: onShowUserPopover og onLeaveGroup - brukes ikke lenger
}

export default function ConversationList({ selectedId, onSelect, currentUser, conversations }: Props) {
    const { conversations: storeConversations } = useChatStore(); // Her lagrer vi samtaler i store, så vi slipper å loade hver gang
    const { loadMore, loading, hasMore } = usePaginatedConversations(); // Henter samtaler med paginering fra usePaginatedConversations
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    
    const getOtherUser = (conv: ConversationDTO): UserSummaryDTO | undefined => {
      return conv.participants.find(p => p.id !== currentUser?.id);
    };
    
    const displayedConversations = conversations ?? storeConversations; // Vise samtaler eller søkesamtaler
    const hasLoadedConversations = useChatStore((s) => s.hasLoadedConversations);
    const unreadConversationIds = useChatStore(state => state.unreadConversationIds);

    // Håndtere scrolling og paginering
    const handleScroll = () => {
        console.log("📜 load - Scroll event fired");
      if (conversations) return; // deaktivert under søk

      const container = scrollContainerRef.current;
      console.log("🔎 Check: loading=", loading, "hasMore=", hasMore);
        if (!container || loading || !hasMore) {
          console.log("🚫 Not loading more:", { loading, hasMore });
          return;
        }

      const { scrollTop, scrollHeight, clientHeight } = container;
        console.log("📏 load - Scroll pos:", { scrollTop, clientHeight, scrollHeight });
       if (scrollTop + clientHeight >= scrollHeight - 50) {
          console.log("📥 Near bottom, loading more...");
          loadMore();
        }
    };

    // Trenger å sjekke at denne funker
    const [hasAutoLoadedOnce, setHasAutoLoadedOnce] = useState(false);

    useEffect(() => {
      if (    
        hasAutoLoadedOnce ||
        conversations ||
        !hasLoadedConversations ||
        storeConversations.length <= take
      ) return;

      const container = scrollContainerRef.current;
      if (
        container &&
        container.scrollHeight <= container.clientHeight &&
        !loading &&
        hasMore
      ) {
        console.log("🧪 autoLoad check:", {
          loaded: hasLoadedConversations,
          conversationsCount: storeConversations.length,
          loading,
          hasMore,
        });
        loadMore();
        setHasAutoLoadedOnce(true);
      }
    }, [
      storeConversations.length,
      loadMore,
      loading,
      hasMore,
      conversations,
      hasLoadedConversations,
      hasAutoLoadedOnce,
    ]);

    if (!conversations && !hasLoadedConversations && storeConversations.length === 0) {
      return (
        <div className="flex justify-center items-center h-full">
          <div className="animate-spin rounded-full h-10 w-10 border-4 border-t-green-600 border-gray-200"></div>
        </div>
      );
    }
    
    return (
      <div 
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="w-full h-full overflow-y-auto overflow-x-hidden custom-scrollbar"
      >
        {storeConversations.length === 0 && loading ? (
          <div className="flex justify-center items-center h-full">
            <div className="animate-spin rounded-full h-10 w-10 border-4 border-t-green-600 border-gray-200"></div>
          </div>
        ) : (
          <>
            <ul className="space-y-2 px-2">
              {displayedConversations.map((conv) => {
                const hasUnread = unreadConversationIds.includes(conv.id);
                const isGroup = conv.isGroup;
                const otherUser = getOtherUser(conv);

                if (isGroup) {
                  return (
                    <ConversationListItem
                      key={conv.id}
                      user={{
                        id: conv.id,
                        fullName: conv.groupName || "Navnløs gruppe",
                        profileImageUrl: conv.groupImageUrl || "/default-group.png",
                      }}
                      selected={selectedId === conv.id}
                      isPendingApproval={conv.isPendingApproval}
                      hasUnread={hasUnread}
                      onClick={() => onSelect(conv.id)}
                      isGroup={true}
                      memberCount={conv.participants.length}
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
                    hasUnread={hasUnread}
                    onClick={() => onSelect(conv.id)}
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