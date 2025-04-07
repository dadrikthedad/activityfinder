"use client";

import Link from "next/link";
import { useAuth } from "@/context/AuthContext";

export default function ProfileLink({
  className = "",
  children = "Profile",
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  const { userId } = useAuth();

  if (!userId) {
    return <span className="text-gray-400 px-4 py-2">Loading...</span>;
  }

  return (
    <Link
      href={`/profile/${userId}`}
      className={`hover:bg-[#0F3D0F] px-4 py-2 rounded-md transition ${className}`}
    >
      {children}
    </Link>
  );
}
