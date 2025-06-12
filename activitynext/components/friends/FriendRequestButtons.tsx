import ProfileNavButton from "../settings/ProfileNavButton";

type Props = {
  requestId: number;
  isLoading: boolean;
  onRespond: (id: number, action: "accept" | "decline") => void;
  variant?: "icons" | "text";
  size?: "small" | "smallx";
};

export default function FriendRequestButtons({
  requestId,
  isLoading,
  onRespond,
  variant = "text",
  size = "small",
}: Props) {
  const isIcon = variant === "icons";

  return (
    <div className="flex gap-2">
      <ProfileNavButton
        text={isIcon ? "✔" : "Accept"}
        onClick={() => onRespond(requestId, "accept")}
        disabled={isLoading}
        variant={size}
        className={isIcon
          ? "bg-green-600 hover:bg-green-700 text-white text-lg font-bold flex items-center justify-center"
          : "bg-[#1C6B1C] hover:bg-[#0F3D0F] text-white"}
      />
      <ProfileNavButton
        text={isIcon ? "✖" : "Reject"}
        onClick={() => onRespond(requestId, "decline")}
        disabled={isLoading}
        variant={size}
        className={isIcon
          ? "bg-gray-500 hover:bg-gray-600 text-white text-lg font-bold flex items-center justify-center"
          : "bg-gray-500 hover:bg-gray-600 text-white"}
      />
    </div>
  );
}
