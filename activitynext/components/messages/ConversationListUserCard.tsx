// Viser kortene til en bruker i Conv og Pending listene
import { UserSummaryDTO } from "@/types/UserSummaryDTO";
import MiniAvatar from "../common/MiniAvatar";

interface Props {
  user: UserSummaryDTO
  selected?: boolean;
  onClick?: (id: string | number) => void;
  subtitle?: string;
  isClickable?: boolean;
  isPendingApproval?: boolean;
  onShowUserPopover: (user: UserSummaryDTO, pos: { x: number; y: number }) => void; // 👈 Ny prop
  hasUnread?: boolean;
}

export const ConversationListItem = ({
  user,
  selected = false,
  onClick,
  subtitle,
  isClickable = true,
  isPendingApproval = false,
  onShowUserPopover,
  hasUnread,
}: Props) => {
  
  // For å regne hvor UserActionPopover skal åpnes
  const handleAvatarClick = (event: React.MouseEvent) => {
    event.stopPropagation();
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const pos = {
      x: rect.left + window.scrollX,
      y: rect.bottom + window.scrollY,
    };
    onShowUserPopover(user, pos);
  };

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
      <button onClick={handleAvatarClick} className="flex-shrink-0">
          <MiniAvatar imageUrl={user.profileImageUrl ?? "/default-avatar.png"} size={40} alt={user.fullName} />
      </button>
      <div className="flex-1 overflow-hidden">
        <span className="text-sm font-medium block truncate whitespace-nowrap overflow-hidden flex items-center gap-1">
        {user.fullName}
        {hasUnread && (
          <span className="inline-block w-2 h-2 bg-green-600 rounded-full" title="Unread message" />
        )}
      </span>
        {subtitle && (
          <span className="text-xs text-gray-500 block truncate whitespace-nowrap overflow-hidden">
            {subtitle}
          </span>
        )}
      </div>
    </div>
  );
};
