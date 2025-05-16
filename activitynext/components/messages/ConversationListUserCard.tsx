// Viser kortene til en bruker i Conv og Pending listene
import UserActionPopover from "../common/UserActionPopover";

interface Props {
  id: number | string;
  name: string;
  imageUrl: string;
  selected?: boolean;
  onClick?: (id: string | number) => void;
  subtitle?: string;
  isClickable?: boolean;
  isPendingApproval?: boolean;
  dropdownRef?: React.RefObject<HTMLDivElement | null>;
  setUserPopoverRef: (ref: React.RefObject<HTMLDivElement>) => void;
  openUserPopoverId: number | null;
  toggleUserPopover: (userId: number) => void; 
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
  dropdownRef,
  setUserPopoverRef,
  openUserPopoverId,
  toggleUserPopover,
}: Props) => {
      const borderClass =
      selected
        ? "border-2 border-[#166016]" // Prioriterer selected hvis begge er true
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
      <UserActionPopover
        user={{
          id: typeof id === "string" ? parseInt(id) : id,
          fullName: name,
          profileImageUrl: imageUrl,
        }}
        avatarSize={40}
        dropdownRef={dropdownRef}
        setUserPopoverRef={setUserPopoverRef}
        openUserPopoverId={openUserPopoverId}
        toggleUserPopover={toggleUserPopover}
        />
      <div className="flex-1">
        <span className="text-sm font-medium truncate block">{name}</span>
        {subtitle && <span className="text-xs text-gray-500">{subtitle}</span>}
      </div>
      </div>
  );
};
