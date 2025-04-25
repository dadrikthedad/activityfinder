// her er den røde runding som viser at vi har fått notification
"use client";

interface NotificationBadgeProps {
  count: number;
}

export default function NotificationBadge({ count }: NotificationBadgeProps) {
  if (count <= 0) return null;

  return (
    <span className="absolute -top-2 -left-10 bg-[#40E0D0] text-whitetext-sm font-bold px-3 py-1.5 rounded-full animate-orbit shadow-[0_0_20px_6px_#40E0D0]">
      {count}
    </span>
  );
}
