// Listen med medlingsforespørsler som vises over ConversationList i MessageDropdown.
"use client"

import { ConversationListItem } from "./ConversationListUserCard";
import React, { useEffect, useState } from "react";
import { usePendingMessageRequests } from "@/hooks/messages/usePendingMessageRequests";
import { useApproveMessageRequest } from "@/hooks/messages/useApproveMessageRequest";
import ProfileNavButton from "../settings/ProfileNavButton";
import { UserSummaryDTO } from "@/types/UserSummaryDTO";
import { useRejectMessageRequest } from "@/hooks/messages/useRejectMessageRequest";
import { ConversationDTO } from "@/types/ConversationDTO";



interface PendingRequestsListProps {
  limit?: number;
  showMoreLink?: boolean;
  onSelectConversation?: (conversationId: number) => void;
  currentUser: UserSummaryDTO | null;
    onShowUserPopover: (
    user: UserSummaryDTO, 
    pos: { x: number; y: number },
    groupData?: {
      isGroup: boolean;
      participants: UserSummaryDTO[];
      onLeaveGroup?: () => void; // ✅ Legg til onLeaveGroup (men vi sender ikke den for pending)
      isPendingRequest?: boolean;
    }
  ) => void;
  conversations?: ConversationDTO[];
  onLeaveGroup?: (conversationId: number) => void;// 👈 Ny prop
}

const PendingRequestsList = ({
  limit,
  showMoreLink = false,
  onSelectConversation,
  onShowUserPopover,
}: PendingRequestsListProps) => {
  const { requests, loading, error } = usePendingMessageRequests();
  const { approve, loading: approving } = useApproveMessageRequest();
  const { reject, loading: rejecting } = useRejectMessageRequest();
  const [rejectedStatus, setRejectedStatus] = useState<Record<number, { name: string }>>({});
  const [fadingOut, setFadingOut] = useState<Record<number, boolean>>({});
  const [removedConversations, setRemovedConversations] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (requests && requests.length > 0) {
      console.log("Loaded requests:", requests);
    }
  }, [requests]);

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
        {visibleRequests.map((r) => (
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
              onShowUserPopover={(user, pos) => 
                r.isGroup 
                  ? onShowUserPopover(user, pos, {
                      isGroup: true,
                      participants: r.participants || [],
                      isPendingRequest: true,
                    })
                  : onShowUserPopover(user, pos)
              }
              // ✅ Legg til gruppe-props
              isGroup={r.isGroup || false}
              memberCount={r.isGroup ? (r.participants?.length || 0) : undefined}
            />
            <div className="mt-1 flex gap-2 pl-12">
                <ProfileNavButton
                    text="✔"
                    onClick={async () => {
                        if (r.conversationId !== null && r.conversationId !== undefined) {
                        await approve(r.senderId, r.conversationId);
                        console.log("✔ Approved conversation:", r.conversationId);
                         // 👈 naviger til samtalen etterpå
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
                        
                        // 1. Vis "rejected"-melding
                        setRejectedStatus(prev => ({
                          ...prev,
                          [r.conversationId!]: { name: r.senderName }
                        }));
                                                
                        // 2. Start fade ut av kort
                        setTimeout(() => {
                          setFadingOut(prev => ({ ...prev, [id]: true }));
                        }, 800);

                        // 3. Fjern samtalen
                        setTimeout(async () => {
                          await reject(r.senderId, id);
                          setRemovedConversations(prev => new Set(prev).add(id));
                        }, 1500);

                        // 4. Fjern "You rejected..." teksten etter enda litt tid
                        setTimeout(() => {
                          setRejectedStatus(prev => {
                            const updated = { ...prev };
                            delete updated[id];
                            return updated;
                          });
                        }, 4000); // teksten vises i 4 sekunder totalt
                      }
                    }}
                    disabled={approving || rejecting}
                    variant="smallx"
                    className="bg-gray-500 hover:bg-gray-600 text-white text-lg font-bold flex items-center justify-center"
                /> 
                </div>
          </li>
        ))}
      </ul>
      {Object.entries(rejectedStatus).map(([id, info]) => (
        <p key={id} className="text-sm text-yellow-300 mt-1 ml-4 animate-fade-out-slow">
          You rejected the message request from <span className="font-medium">{info.name}</span>
        </p>
      ))}

      {showMoreLink && requests.length > (limit ?? 0) && (
        <div className="mt-2 text-sm flex justify-end pr-2">
          <ProfileNavButton
            href="/chat"       // Eller "/chat" om du vil til selve chat-siden
            text="See more"
            variant="small"             // Velg variant som passer – f.eks. "small", "normal", "tiny" osv.
            className="text-blue-500 hover:underline p-0 mr-15" // p-0 fjerner padding om du ønsker link-utseende
          />
        </div>
      )}
    </div>
  );
};

export default React.memo(PendingRequestsList);