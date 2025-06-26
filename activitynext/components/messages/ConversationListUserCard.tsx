// Viser kortene til en bruker i Conv og Pending listene
import { UserSummaryDTO } from "@/types/UserSummaryDTO";
import ClickableAvatar from "../common/ClickableAvatar"; // ✅ Bytt ut MiniAvatar import
import { useChatStore } from "@/store/useChatStore";

interface Props {
  user: UserSummaryDTO
  selected?: boolean;
  onClick?: (id: string | number) => void;
  subtitle?: string;
  isClickable?: boolean;
  isPendingApproval?: boolean;
  hasUnread?: boolean;
  isGroup?: boolean;
  memberCount?: number;
}

export const ConversationListItem = ({
  user,
  selected = false,
  onClick,
  subtitle,
  isClickable = true,
  isPendingApproval = false,
  hasUnread,
  isGroup = false,
  memberCount,
}: Props) => {
 
  // Hent participants fra conversation store hvis det er en gruppe
  const conversations = useChatStore((s) => s.conversations);
  const conversation = isGroup ? conversations.find(c => c.id === user.id) : null;
  const participants = conversation?.participants || [];
   
  const borderClass = selected
    ? "border-2 border-[#166016]"
    : isPendingApproval
    ? "border-2 border-yellow-300"
    : "border border-transparent";
   
  return (
    <div
      onClick={() => onClick && onClick(user.id)}
      className={`flex items-center gap-3 p-2 rounded-md transition ${borderClass} ${
        isClickable ? "cursor-pointer" : "cursor-default"
      } ${
        selected
          ? "bg-[#e0f2e0] dark:bg-[#2c2f30]"
          : isClickable
          ? "hover:bg-gray-100 dark:hover:bg-gray-700"
          : "bg-gray-50 dark:bg-[#2b2f2f]"
      }`}
    >
      {/* ✅ Bruk ClickableAvatar i stedet for button + MiniAvatar */}
      <div className="relative">
        <ClickableAvatar
          user={user}
          size={40}
          isGroup={isGroup}
          participants={participants}
          isPendingRequest={isPendingApproval}
          conversationId={typeof user.id === 'number' ? user.id : undefined}
          className="flex-shrink-0"
        />
        
        {/* ✅ Gruppeindikator - flytt til egen div for bedre kontroll */}
        {isGroup && (
          <span className="absolute -bottom-1 -right-1 bg-blue-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
            👥
          </span>
        )}
      </div>
     
      <div className="flex-1 overflow-hidden">
        <span className="text-sm font-medium block truncate whitespace-nowrap overflow-hidden flex items-center gap-1">
          {user.fullName}
          {hasUnread && (
            <span className="inline-block w-2 h-2 bg-green-600 rounded-full" title="Unread message" />
          )}
        </span>
       
        {/* Vis medlemsantall eller eksisterende subtitle */}
        {isGroup && memberCount ? (
          <span className="text-xs text-gray-500 block truncate whitespace-nowrap overflow-hidden">
            {memberCount} medlemmer
          </span>
        ) : subtitle ? (
          <span className="text-xs text-gray-500 block truncate whitespace-nowrap overflow-hidden">
            {subtitle}
          </span>
        ) : null}
      </div>
    </div>
  );
};