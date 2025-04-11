"use client";

import Link from "next/link";
import FormButton from "@/components/FormButton";

interface ProfileNavButtonProps {
  href?: string;
  text: string;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  variant?: "default" | "small" | "large" | "long" | "normal" | "iconOnly";
}

export default function ProfileNavButton({
  href,
  text,
  onClick,
  disabled = false,
  className = "",
  variant = "default",
}: ProfileNavButtonProps) {
  let baseClasses = "";

  switch (variant) {
    case "small":
      baseClasses = "w-[140px] text-sm px-4 py-2";
      break;
    case "large":
      baseClasses = "w-[240px] text-xl px-8 py-4";
      break;
    case "iconOnly":
      baseClasses = "w-[48px] h-[48px] p-2 text-base"; // du kan bruke en ikonkomponent som children senere
      break;
    case "normal":
      baseClasses ="w-48 h-12 text-lg px-4 py-2 text-center whitespace-nowrap overflow-hidden text-ellipsis";
      break;
    case "long":
        baseClasses = "w-[280px] h-14 text-lg px-4 py-2 text-center whitespace-nowrap overflow-hidden text-ellipsis";
        break;
    case "default":
    default:
      baseClasses = "w-[200px] text-lg px-6 py-3";
      break;
  }

  const button = (
    <FormButton
      text={text}
      type="button"
      fullWidth={false}
      onClick={onClick}
      disabled={disabled}
      className={`${baseClasses} ${className}`}
    />
  );

  return href ? <Link href={href}>{button}</Link> : button;
}