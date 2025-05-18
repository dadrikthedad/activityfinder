// Listen med medlingsforespørsler som vises over ConversationList i MessageDropdown.
"use client"

import { ConversationListItem } from "./ConversationListUserCard";
import Link from "next/link";
import React, { useEffect } from "react";
import { usePendingMessageRequests } from "@/hooks/messages/usePendingMessageRequests";
import { useApproveMessageRequest } from "@/hooks/messages/useApproveMessageRequest";
import ProfileNavButton from "../settings/ProfileNavButton";
import { useChatStore } from "@/store/useChatStore"; 
import { UserSummaryDTO } from "@/types/UserSummaryDTO";


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
  const { setPendingLockedConversationId } = useChatStore();

  useEffect(() => {
    if (requests && requests.length > 0) {
      console.log("Loaded requests:", requests);
    }
  }, [requests]);

  if (loading) return <p className="px-4 py-2 text-sm"></p>;
  if (error) return <p className="px-4 py-2 text-sm text-red-500">{error}</p>;
  if (!requests || requests.length === 0)
    return <p className="px-4 py-2 text-sm text-gray-500">Ingen forespørsler.</p>;

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
              subtitle={r.limitReached ? "Grense nådd" : undefined}
              onClick={() => {
                console.log("✅ Klikket på samtale:", r.conversationId);
                if (r.conversationId && onSelectConversation) {
                  onSelectConversation(Number(r.conversationId));
                  setPendingLockedConversationId(r.conversationId);
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
                        onSelectConversation?.(r.conversationId); // 👈 naviger til samtalen etterpå
                        }
                    }}
                    disabled={approving}
                    variant="smallx"
                    className="bg-[#1C6B1C] hover:bg-[#0F3D0F] text-white text-lg font-bold flex items-center justify-center"
                />
                <ProfileNavButton
                    text="✖"
                    onClick={() => {
                    console.log("Avslo melding fra:", r.senderId);
                    // TODO: Legg til faktisk funksjon for å avslå
                    }}
                    disabled={approving}
                    variant="smallx"
                    className="bg-gray-500 hover:bg-gray-600 text-white text-lg font-bold flex items-center justify-center"
                /> 
                </div>
          </li>
        ))}
      </ul>

      {showMoreLink && requests.length > (limit ?? 0) && (
        <div className="mt-2 text-sm text-right pr-2">
          <Link href="/chat/requests" className="text-blue-500 hover:underline">
            Vis alle forespørsler →
          </Link>
        </div>
      )}
    </div>
  );
};

export default React.memo(PendingRequestsList);