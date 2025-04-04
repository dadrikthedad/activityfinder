"use client";

import DropdownProfileNavButton from "@/components/DropdownNavButton";

export default function ProfileActionMenu() {
  return (
    <DropdownProfileNavButton
      text="More Options"
      actions={[
        { label: "Block User", onClick: () => console.log("🚫 Block clicked") },
        { label: "Ignore", onClick: () => console.log("🙈 Ignore clicked") },
        { label: "Report", onClick: () => console.log("🚨 Report clicked") },
      ]}
    />
  );
}