import Image from "next/image";

interface MiniAvatarProps {
  imageUrl: string;
  size?: number; // standard = 40px
  alt?: string;
  withBorder?: boolean; // Hvis true: vis grønn border, ellers ingen/standard
}

export default function MiniAvatar({
  imageUrl,
  size = 40,
  alt = "Profile avatar",
  withBorder = true,
}: MiniAvatarProps) {
  const borderClasses = withBorder
    ? "border-4 border-green-700 shadow-md"
    : "border border-gray-300 shadow-sm";

  return (
    <div
      className={`rounded-full overflow-hidden ${borderClasses}`}
      style={{ width: size, height: size, minWidth: size }}
    >
      <Image
        src={imageUrl}
        alt={alt}
        width={size}
        height={size}
        className="object-cover w-full h-full rounded-full"
      />
    </div>
  );
}
