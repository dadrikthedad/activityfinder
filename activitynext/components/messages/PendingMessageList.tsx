// Listen med medlingsforespørsler som vises over ConversationList i MessageDropdown.
"use client"

import { ConversationListItem } from "./ConversationListUserCard";
import Link from "next/link";
import React, { useEffect } from "react";
import { usePendingMessageRequests } from "@/hooks/messages/usePendingMessageRequests";

interface PendingRequestsListProps {
  limit?: number;
  showMoreLink?: boolean;
  onSelectConversation?: (conversationId: number) => void;
}

const PendingRequestsList = ({
  limit,
  showMoreLink = false,
  onSelectConversation,
}: PendingRequestsListProps) => {
  const { requests, loading, error } = usePendingMessageRequests();

  useEffect(() => {
    if (requests && requests.length > 0) {
      console.log("Loaded requests:", requests);
    }
  }, [requests]);

  if (loading) return <p className="px-4 py-2 text-sm">Laster forespørsler...</p>;
  if (error) return <p className="px-4 py-2 text-sm text-red-500">{error}</p>;
  if (!requests || requests.length === 0)
    return <p className="px-4 py-2 text-sm text-gray-500">Ingen forespørsler.</p>;

  const visibleRequests = limit ? requests.slice(0, limit) : requests;

  return (
    <div className="px-2">
      <ul className="space-y-2">
        {visibleRequests.map((r) => (
          <ConversationListItem
            key={`${r.senderId}-${r.conversationId ?? "privat"}`}
            id={r.conversationId ?? `request-${r.senderId}`}
            name={r.isGroup ? r.groupName ?? "Gruppe" : r.senderName}
            imageUrl={
              r.isGroup
                ? "/default-group.png"
                : r.profileImageUrl || "/default-avatar.png"
            }
            isClickable={true}
            subtitle={r.limitReached ? "Grense nådd" : undefined}
            onClick={() => {
              console.log("✅ Klikket på samtale:", r.conversationId);
              if (r.conversationId && onSelectConversation) {
                onSelectConversation(Number(r.conversationId));
              }
            }}
          />
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