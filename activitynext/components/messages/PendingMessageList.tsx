// Oppdatert PendingMessageList som sender participants til ConversationListItem
"use client"

import { ConversationListItem } from "./ConversationListUserCard";
import React, { useEffect, useState } from "react";
import { usePendingMessageRequests } from "@/hooks/messages/usePendingMessageRequests";
import { useApproveMessageRequest } from "@/hooks/messages/useApproveMessageRequest";
import ProfileNavButton from "../settings/ProfileNavButton";
import { useRejectMessageRequest } from "@/hooks/messages/useRejectMessageRequest";
import { ConversationDTO } from "@/types/ConversationDTO";
import { UserSummaryDTO } from "@/types/UserSummaryDTO"; // ✅ LEGG TIL import
import { useChatStore } from "@/store/useChatStore";

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
  const { requests, loading, error } = usePendingMessageRequests();
  const { approve, loading: approving } = useApproveMessageRequest();
  const { reject, loading: rejecting } = useRejectMessageRequest();
  const [rejectedStatus, setRejectedStatus] = useState<Record<number, { name: string }>>({});
  const [fadingOut, setFadingOut] = useState<Record<number, boolean>>({});
  const [removedConversations, setRemovedConversations] = useState<Set<number>>(new Set());

  // Hent conversations fra chat store
  const conversations = useChatStore((s) => s.conversations);

  useEffect(() => {
    if (requests && requests.length > 0) {
      console.log("🔍 DEBUG Pending requests:", requests);
      console.log("🔍 DEBUG Store conversations:", conversations);
      
      // Debug hver request
      requests.forEach(r => {
        console.log(`🔍 DEBUG Request ${r.conversationId}:`, {
          isGroup: r.isGroup,
          participants: r.participants,
          conversationId: r.conversationId,
          foundInStore: conversations.find(c => c.id === r.conversationId)
        });
      });
    }
  }, [requests, conversations]);

  if (loading) {
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

          console.log(`🔍 DEBUG Request ${r.conversationId} final participants:`, {
            fromRequest: r.participants?.length || 0,
            fromStore: storeParticipants.length,
            finalCount: participants.length,
            memberCount,
            willSendToConversationListItem: participants
          });
          
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
                // ✅ VIKTIG: Send participants eksplisitt til ConversationListItem
                participants={participants}
              />
              <div className="mt-1 flex gap-2 pl-12">
                  <ProfileNavButton
                      text="✔"
                      onClick={async () => {
                          if (r.conversationId !== null && r.conversationId !== undefined) {
                          await approve(r.conversationId);
                          console.log("✔ Approved conversation:", r.conversationId);
                          }
                      }}
                      disabled={approving || rejecting}
                      variant="smallx"
                      className="bg-[#1C6B1C] hover:bg-[#0F3D0F] text-white text-lg font-bold flex items-center justify-center"
                  />
                  <ProfileNavButton
                      text="✖"
                     onClick={async () => {
                        if (r.conversationId != null) {
                          const id = r.conversationId!;
                          
                          setRejectedStatus(prev => ({
                            ...prev,
                            [r.conversationId!]: { name: r.senderName }
                          }));
                                                  
                          setTimeout(() => {
                            setFadingOut(prev => ({ ...prev, [id]: true }));
                          }, 800);

                          setTimeout(async () => {
                            await reject(r.senderId, id);
                            setRemovedConversations(prev => new Set(prev).add(id));
                          }, 1500);

                          setTimeout(() => {
                            setRejectedStatus(prev => {
                              const updated = { ...prev };
                              delete updated[id];
                              return updated;
                            });
                          }, 4000);
                        }
                      }}
                      disabled={approving || rejecting}
                      variant="smallx"
                      className="bg-gray-500 hover:bg-gray-600 text-white text-lg font-bold flex items-center justify-center"
                  /> 
                  </div>
            </li>
          );
        })}
      </ul>
      {Object.entries(rejectedStatus).map(([id, info]) => (
        <p key={id} className="text-sm text-yellow-300 mt-1 ml-4 animate-fade-out-slow">
          You rejected the message request from <span className="font-medium">{info.name}</span>
        </p>
      ))}

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