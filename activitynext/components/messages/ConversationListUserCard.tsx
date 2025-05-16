// Viser kortene til en bruker i Conv og Pending listene
import { UserSummaryDTO } from "@/types/UserSummaryDTO";
import MiniAvatar from "../common/MiniAvatar";

interface Props {
  id: number | string;
  name: string;
  imageUrl: string;
  selected?: boolean;
  onClick?: (id: string | number) => void;
  subtitle?: string;
  isClickable?: boolean;
  isPendingApproval?: boolean;
  onShowUserPopover: (user: UserSummaryDTO, pos: { x: number; y: number }) => void; // 👈 Ny prop
}

export const ConversationListItem = ({
  id,
  name,
  imageUrl,
  selected = false,
  onClick,
  subtitle,
  isClickable = true,
  isPendingApproval = false,
  onShowUserPopover,
}: Props) => {
  const user: UserSummaryDTO = {
    id: typeof id === "string" ? parseInt(id) : id,
    fullName: name,
    profileImageUrl: imageUrl,
  };
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
      onClick={() => onClick && onClick(id)}
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
        <MiniAvatar imageUrl={imageUrl} size={40} alt={name} />
      </button>
      <div className="flex-1">
        <span className="text-sm font-medium truncate block">{name}</span>
        {subtitle && <span className="text-xs text-gray-500">{subtitle}</span>}
      </div>
    </div>
  );
};
