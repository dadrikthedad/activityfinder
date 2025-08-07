//Komponent som er en dropdown når man er på en bruker sin side. Her er det ekstra settings som ikke har en egen knapp. MÅ ENDRE SENERE VED NYE FUNKSJONER
"use client";
import DropdownProfileNavButton from "@/components/DropdownNavButton";

interface Props {
  isFriend: boolean;
  onRemoveFriend?: () => void;
}

export default function ProfileActionMenu({ isFriend, onRemoveFriend }: Props) {
  const actions = [
    ...(isFriend && onRemoveFriend
      ? [{ label: "Remove Friend", onClick: onRemoveFriend }]
      : []),
    { label: "Block User", onClick: () => console.log("🚫 Block clicked") },
    { label: "Ignore", onClick: () => console.log("🙈 Ignore clicked") },
    { label: "Report", onClick: () => console.log("🚨 Report clicked") },
  ];

  return (
    <DropdownProfileNavButton
      text="More Options"
      actions={actions}
    />
  );
}