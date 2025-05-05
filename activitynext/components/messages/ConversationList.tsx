// samtaleliste som henter alle brukerne og viser de enten med miniavatar i dropdown eller useractionpopover.tsx i chatpage
import { ConversationDTO } from "@/types/ConversationDTO";
import UserActionPopover from "../common/UserActionPopover";
import MiniAvatar from "../common/MiniAvatar";
import ReusableDropdownButton from "../common/Dropdown";
import { useRouter } from "next/navigation";
import ProfileNavButton from "../settings/ProfileNavButton";

interface Props {
    conversations: ConversationDTO[];
    selectedConversationId: number | null;
    onSelect: (id: number) => void;
    currentUserId: number | undefined;
    useMiniAvatarOnly?: boolean;
  }

export default function ConversationList({
    conversations,
    selectedConversationId,
    onSelect,
    currentUserId,
    useMiniAvatarOnly,
  }: Props) {
    const router = useRouter();
    return (
        <div
  className="w-[360px] max-h-[70vh] flex-shrink-0 overflow-y-auto"
  style={{
    overflowX: "hidden",
    scrollbarWidth: "none", // Firefox
    msOverflowStyle: "none", // IE 10+
  }}
>
  <div style={{ direction: "ltr" }}>
        {conversations.map((conv) => {
  const isGroup = conv.isGroup;
  const otherUser = !isGroup
    ? conv.participants.find((p) => p.id !== currentUserId)
    : null;
   

  // Desktop: knapp til venstre
  if (!useMiniAvatarOnly) {
    return (
      <div key={conv.id} className="flex items-center gap-2 relative">
        <div className="relative">
        {/* ⚙ Knapp til venstre */}
        
        <ReusableDropdownButton
        text="⚙"
        variant="iconOnly"
        actions={
            otherUser
              ? [
                  {
                    label: "Visit Profile",
                    onClick: () => router.push(`/profile/${otherUser.id}`),
                  },
                ]
              : []
          }
        />
        </div>

        {/* Samtalekort */}
        <div
          onClick={() => onSelect(conv.id)}
          className={`flex-1 p-4 border border-[#1C6B1C] rounded-lg shadow-sm cursor-pointer flex items-center gap-4 ${
            conv.id === selectedConversationId
              ? "bg-[#145214] text-white"
              : "bg-white dark:bg-[#1e2122]"
          }`}
        >
          {!isGroup && otherUser ? (
            <>
              <UserActionPopover user={otherUser} avatarSize={40} />
              <div>
                <p className="font-semibold">{otherUser.fullName}</p>
                <p className="text-sm text-gray-500">
                  {conv.lastMessageSentAt
                    ? new Date(conv.lastMessageSentAt).toLocaleString()
                    : "Ingen meldinger"}
                </p>
              </div>
            </>
          ) : (
            <div>
              <p className="font-semibold">GroupChat: {conv.groupName || "Uten navn"}</p>
              <p className="text-sm text-gray-500">
                {conv.lastMessageSentAt
                  ? new Date(conv.lastMessageSentAt).toLocaleString()
                  : "Ingen meldinger"}
              </p>
            </div>
          )}
          
        </div>
        <ProfileNavButton // Til innstillinger
                          href="/profilesettings"
                          text="Settings"
                          variant="long"
                        />
      </div>
    );
  }

  // Mobile: knapp til høyre, utenfor kortet
return (
    <div key={conv.id} className="flex items-center gap-2 justify-end">
      {/* Samtalekort */}
      <div
        onClick={() => onSelect(conv.id)}
        className={`flex-1 p-4 border border-[#1C6B1C] rounded-lg shadow-sm cursor-pointer flex items-center gap-4 ${
          conv.id === selectedConversationId
            ? "bg-[#145214] text-white"
            : "bg-white dark:bg-[#1e2122]"
        }`}
      >
        <MiniAvatar
          imageUrl={otherUser?.profileImageUrl ?? "/default-avatar.png"}
          size={40}
        />
        <div>
          <p className="font-semibold">{otherUser?.fullName}</p>
          <p className="text-sm text-gray-500">
            {conv.lastMessageSentAt
              ? new Date(conv.lastMessageSentAt).toLocaleString()
              : "Ingen meldinger"}
          </p>
        </div>
      </div>
  
      {/* ⚙ Knapp til høyre for kortet */}
      
        <ReusableDropdownButton
        text="⚙"
        variant="iconOnly"
        actions={
            otherUser
              ? [
                  {
                    label: "Visit Profile",
                    onClick: () => router.push(`/profile/${otherUser.id}`),
                  },
                ]
              : []
          }
        />
    </div>
  );
})}
      </div>
      </div>
    );
  }