// Viser kortene til en bruker i Conv og Pending listene
import Image from "next/image";

interface Props {
  id: number | string;
  name: string;
  imageUrl: string;
  selected?: boolean;
  onClick?: (id: string | number) => void;
  subtitle?: string;
  isClickable?: boolean;
}

export const ConversationListItem = ({
  id,
  name,
  imageUrl,
  selected = false,
  onClick,
  subtitle,
  isClickable = true,
}: Props) => {
  return (
     <div
      onClick={() => onClick && onClick(id)}
      className={`flex items-center gap-3 p-2 rounded-md transition ${
        isClickable ? "cursor-pointer" : "cursor-default"
      } ${
        selected
          ? "bg-[#e0f2e0] dark:bg-[#2c2f30]"
          : isClickable
          ? "hover:bg-gray-100 dark:hover:bg-gray-700"
          : "bg-gray-50 dark:bg-[#2b2f2f]"
      }`}
    >
      <Image
        src={imageUrl}
        alt={name}
        width={40}
        height={40}
        className="rounded-full object-cover w-10 h-10"
      />
      <div className="flex-1">
        <span className="text-sm font-medium truncate block">{name}</span>
        {subtitle && <span className="text-xs text-gray-500">{subtitle}</span>}
      </div>
    </div>
  );
};
