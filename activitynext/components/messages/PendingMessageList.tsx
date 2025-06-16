// Listen med medlingsforespørsler som vises over ConversationList i MessageDropdown.
"use client"

import { ConversationListItem } from "./ConversationListUserCard";
import React, { useEffect, useState } from "react";
import { usePendingMessageRequests } from "@/hooks/messages/usePendingMessageRequests";
import { useApproveMessageRequest } from "@/hooks/messages/useApproveMessageRequest";
import ProfileNavButton from "../settings/ProfileNavButton";
import { UserSummaryDTO } from "@/types/UserSummaryDTO";
import { useRejectMessageRequest } from "@/hooks/messages/useRejectMessageRequest";



interface PendingRequestsListProps {
  limit?: number;
  showMoreLink?: boolean;
  onSelectConversation?: (conversationId: number) => void;
  onShowUserPopover: (user: UserSummaryDTO, pos: { x: number; y: number }) => void; // 👈 Ny prop
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
  const [rejectedStatus, setRejectedStatus] = useState<Record<number, boolean>>({});

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

  const visibleRequests = limit ? requests.slice(0, limit) : requests;

   return (
    <div className="px-2">
      <ul className="space-y-4">
        {visibleRequests.map((r) => (
          <li key={`${r.senderId}-${r.conversationId ?? "privat"}`}>
            <ConversationListItem
              user={{
                id: r.senderId,
                fullName: r.senderName,
                profileImageUrl: r.profileImageUrl || "/default-avatar.png",
              }}
              isClickable={true}
              isPendingApproval={true}
              onClick={() => {
                console.log("✅ Klikket på samtale:", r.conversationId);
                if (r.conversationId && onSelectConversation) {
                  onSelectConversation(r.conversationId);
                }
              }}
              onShowUserPopover={onShowUserPopover} 
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
                      if (r.conversationId !== null && r.conversationId !== undefined) {
                        setRejectedStatus((prev) => ({ ...prev, [r.conversationId!]: true }));

                        setTimeout(async () => {
                          await reject(r.senderId, r.conversationId!);
                          // Fjernes først nå, etter at beskjeden fikk vises
                        }, 2000);
                      }
                    }}
                    disabled={approving || rejecting}
                    variant="smallx"
                    className="bg-gray-500 hover:bg-gray-600 text-white text-lg font-bold flex items-center justify-center"
                /> 
                </div>
                {rejectedStatus[r.conversationId ?? -1] && (
                  <p className="text-sm text-gray-500 mt-1 ml-1 animate-fade-out">You rejected the message request</p>
                )}
          </li>
        ))}
      </ul>

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