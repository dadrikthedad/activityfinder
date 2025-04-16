import Image from "next/image";

interface MiniAvatarProps {
  imageUrl: string;
  size?: number; // standard = 40px
  alt?: string;
}

export default function MiniAvatar({
  imageUrl,
  size = 40,
  alt = "Profile avatar",
}: MiniAvatarProps) {
  return (
    <div
      className="rounded-full overflow-hidden border border-gray-300 shadow-sm"
      style={{ width: size, height: size }}
    >
      <Image
        src={imageUrl}
        alt={alt}
        width={size}
        height={size}
        className="object-cover w-full h-full"
      />
    </div>
  );
}