// Oppdatert PendingMessageList med paginering
"use client"

import { ConversationListItem } from "./ConversationListUserCard";
import React, { useState } from "react";
import { usePendingMessageRequests } from "@/hooks/messages/usePendingMessageRequests";
import { useApproveMessageRequest } from "@/hooks/messages/useApproveMessageRequest";
import ProfileNavButton from "../settings/ProfileNavButton";
import { useRejectMessageRequest } from "@/hooks/messages/useRejectMessageRequest";
import { ConversationDTO } from "@shared/types/ConversationDTO";
import { UserSummaryDTO } from "@shared/types/UserSummaryDTO";
import { useChatStore } from "@/store/useChatStore";
import { useConfirmDialog } from "@/hooks/useConfirmDialog";
import { MessageRequestDTO } from "@shared/types/MessageReqeustDTO";

interface PendingRequestsListProps {
  limit?: number;
  showMoreLink?: boolean;
  onSelectConversation?: (conversationId: number) => void;
  conversations?: ConversationDTO[];
  onLeaveGroup?: (conversationId: number) => void;
}

const PendingRequestsList = ({
  limit,
  showMoreLink = false,
  onSelectConversation,
}: PendingRequestsListProps) => {
  // ✅ OPPDATERT: Bruk nye property names fra hook
  const { 
    requests, 
    isLoading, 
    error,
    removeRequest 
  } = usePendingMessageRequests();
  
  const { approve, loading: approving } = useApproveMessageRequest();
  const { reject, loading: rejecting } = useRejectMessageRequest();
  const { confirm, ConfirmDialog } = useConfirmDialog();
  
  const [fadingOut, setFadingOut] = useState<Record<number, boolean>>({});
  const [removedConversations, setRemovedConversations] = useState<Set<number>>(new Set());

  // Hent conversations fra chat store
  const conversations = useChatStore((s) => s.conversations);

  // ✅ FJERNET: Bootstrap henter første side automatisk

  // ✅ OPPDATERT: Handle reject med removeRequest fra hook
  const handleReject = async (r: MessageRequestDTO) => {
    if (r.conversationId == null) return;

    const requestType = r.isGroup ? "group invitation" : "message request";
    const actionText = r.isGroup ? "decline" : "reject";

    const confirmed = await confirm({
      title: r.isGroup ? "Decline Group Invitation" : "Reject Message Request",
      message: (
        <span>
          Are you sure you want to {actionText} the {requestType} from{" "}
          <span className="font-semibold italic text-base md:text-lg">
            {r.senderName}
          </span>
          {r.isGroup && r.groupName && (
            <>
              {" "}to join{" "}
              <span className="font-semibold italic text-base md:text-lg">
                {r.groupName}
              </span>
            </>
          )}
          ?
        </span>
      ),
    });

    if (!confirmed) return;

    const id = r.conversationId!;
    
    // Start fade out animation
    setFadingOut(prev => ({ ...prev, [id]: true }));

    // Execute reject and remove after animation
    setTimeout(async () => {
      try {
        // 🆕 Pass isGroup parameter to distinguish request types
        await reject(r.senderId, id, r.isGroup || false);
        
        // ✅ OPPDATERT: Bruk removeRequest fra hook i stedet for lokal state
        removeRequest(id);
        setRemovedConversations(prev => new Set(prev).add(id));
      } catch (error) {
        console.error('❌ Error rejecting request:', error);
        // Reset fade out on error
        setFadingOut(prev => ({ ...prev, [id]: false }));
      }
    }, 700); // Match the fade duration
  };

  // ✅ OPPDATERT: Handle approve med removeRequest fra hook
  const handleApprove = async (r: MessageRequestDTO) => {
    if (r.conversationId !== null && r.conversationId !== undefined) {
      try {
        await approve(r.conversationId);
        console.log("✔ Approved conversation:", r.conversationId);
        
        // ✅ OPPDATERT: Fjern fra hook state også
        removeRequest(r.conversationId);
      } catch (error) {
        console.error('❌ Error approving request:', error);
      }
    }
  };

  // ✅ OPPDATERT: Bruk isLoading i stedet for loading
  if (isLoading && requests.length === 0) {
    return (
      <div className="flex justify-center py-4">
        <div className="animate-spin rounded-full h-6 w-6 border-2 border-t-green-600 border-gray-200"></div>
      </div>
    );
  }

  if (error) return <p className="px-4 py-2 text-sm text-red-500">{error}</p>;
  if (!requests || requests.length === 0)
    return <p className="px-4 py-2 text-sm text-gray-500">No requests.</p>;

  const filteredRequests = requests.filter(
    (r) => !removedConversations.has(r.conversationId!)
  );
  const visibleRequests = limit ? filteredRequests.slice(0, limit) : filteredRequests;

  return (
    <div className="px-2">
      <ConfirmDialog />
      
      <ul className="space-y-4">
        {visibleRequests.map((r) => {
          // Hent conversation fra store for å få participants
          const conversationFromStore = r.conversationId ? conversations.find(c => c.id === r.conversationId) : null;
          const storeParticipants = conversationFromStore?.participants || [];
          
          // ✅ PRIORITER: Bruk participants fra request hvis tilgjengelig
          let participants: UserSummaryDTO[] = [];
          if (r.participants && Array.isArray(r.participants) && r.participants.length > 0) {
            participants = r.participants;
          } else if (storeParticipants.length > 0) {
            participants = storeParticipants;
          }
          
          // Beregn memberCount
          const memberCount = r.isGroup ? (participants.length > 0 ? participants.length : 2) : undefined;

          return (
            <li key={`${r.senderId}-${r.conversationId ?? "privat"}`} className={fadingOut[r.conversationId ?? -1] ? "opacity-0 transition-opacity duration-700" : ""}>
              <ConversationListItem
                user={{
                  id: r.isGroup ? r.conversationId ?? 0 : r.senderId,
                  fullName: r.isGroup ? r.groupName ?? "Gruppe" : r.senderName,
                  profileImageUrl: r.isGroup
                    ? r.groupImageUrl || "/default-group.png"
                    : r.profileImageUrl || "/default-avatar.png",
                }}
                isClickable={true}
                isPendingApproval={true}
                onClick={() => {
                  console.log("✅ Klikket på samtale:", r.conversationId);
                  if (r.conversationId && onSelectConversation) {
                    onSelectConversation(r.conversationId);
                  }
                }}
                isGroup={r.isGroup || false}
                memberCount={memberCount}
                participants={participants}
              />
              <div className="mt-1 flex gap-2 pl-12">
                <ProfileNavButton
                  text="✔"
                  onClick={() => handleApprove(r)}
                  disabled={approving || rejecting}
                  variant="smallx"
                  className="bg-[#1C6B1C] hover:bg-[#0F3D0F] text-white text-lg font-bold flex items-center justify-center"
                />
                <ProfileNavButton
                  text="✖"
                  onClick={() => handleReject(r)}
                  disabled={approving || rejecting}
                  variant="smallx"
                  className="bg-gray-500 hover:bg-gray-600 text-white text-lg font-bold flex items-center justify-center"
                /> 
              </div>
            </li>
          );
        })}
      </ul>
      
      {/* ✅ BEHOLDT: Eksisterende "See more" link for begrenset visning */}
      {showMoreLink && requests.length > (limit ?? 0) && (
        <div className="mt-2 text-sm flex justify-end pr-2">
          <ProfileNavButton
            href="/chat"
            text="See more"
            variant="small"
            className="text-blue-500 hover:underline p-0 mr-15"
          />
        </div>
      )}
    </div>
  );
};

export default React.memo(PendingRequestsList);