// ParticipantsList.tsx - gjenbrukbar komponent
"use client";
import { UserSummaryDTO, GroupRequestStatus } from "@/types/UserSummaryDTO";
import MiniAvatar from "../common/MiniAvatar";

interface ParticipantsListProps {
  participants: UserSummaryDTO[];
  onParticipantClick: (participant: UserSummaryDTO, event: React.MouseEvent) => void;
  showGroupRequestStatus?: boolean; // Om status skal vises eller ikke
  className?: string;
}

export default function ParticipantsList({
  participants,
  onParticipantClick,
  showGroupRequestStatus = false,
  className = ""
}: ParticipantsListProps) {

  // Hjelpefunksjon for status-info (kun brukt hvis showGroupRequestStatus = true)
  const getStatusInfo = (participant: UserSummaryDTO) => {
    if (!showGroupRequestStatus) return null;
    
    const status = participant.groupRequestStatus;
    
    if (status === "Creator" || status === GroupRequestStatus.Creator) {
      return { text: "(creator)", className: "text-green-800 font-semibold" };
    }
    if (status === "Pending" || status === GroupRequestStatus.Pending) {
      return { text: "(inv)", className: "text", };
    }
  };

  // Sortering (kun hvis showGroupRequestStatus = true)
  const getStatusOrder = (status: GroupRequestStatus | string | null | undefined): number => {
    if (status === "Creator" || status === GroupRequestStatus.Creator) return 0;
    if (status === "Approved" || status === GroupRequestStatus.Approved) return 1;
    if (status === "Pending" || status === GroupRequestStatus.Pending) return 2;
    return 4;
  };

  const sortedParticipants = showGroupRequestStatus 
    ? [...participants].sort((a, b) => getStatusOrder(a.groupRequestStatus) - getStatusOrder(b.groupRequestStatus))
    : participants;

  return (
    <div className={`max-h-48 overflow-y-auto custom-scrollbar ${className}`}>
      {sortedParticipants.map((participant) => {
        const statusInfo = getStatusInfo(participant);
        
        return (
          <button
            key={participant.id}
            className="flex items-center gap-3 w-full px-4 py-2 hover:bg-gray-200 dark:hover:bg-gray-700 text-sm overflow-hidden"
            onClick={(e) => onParticipantClick(participant, e)}
          >
            <MiniAvatar
              imageUrl={participant.profileImageUrl ?? "/default-avatar.png"}
              size={showGroupRequestStatus ? 32 : 24} // Litt større avatar når status vises
              alt={participant.fullName}
              withBorder={false}
            />
            
            {showGroupRequestStatus ? (
              // Med status-info (som i ParticipantsDropdownButton)
              <div className="flex-1 text-left flex items-center justify-between min-w-0">
                <span className="truncate">{participant.fullName}</span>
                {statusInfo && (
                  <div className={`flex items-center gap-1 text-xs ${statusInfo.className} flex-shrink-0`}>
                    {statusInfo.text && <span>{statusInfo.text}</span>}
                  </div>
                )}
              </div>
            ) : (
              // Enkel visning (som i MessageSettingsDropdown)
              <span className="text-left truncate flex-1">{participant.fullName}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}