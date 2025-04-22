// Hovedknappen som finnes rundt omkring, arver fra FormButton og finnes i forskjellige varianter. Brukes i profilesettings, profile/[id], editprofile osv
"use client";

import { useRouter } from "next/navigation";
import FormButton from "@/components/FormButton";

interface ProfileNavButtonProps {
  href?: string;
  text: string;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  variant?: "default" | "small" | "large" | "long" | "normal" | "usual" |"iconOnly" | "smallx";
}

export default function ProfileNavButton({
  href,
  text,
  onClick,
  disabled = false,
  className = "",
  variant = "default",
}: ProfileNavButtonProps) {
  const router = useRouter();

  let baseClasses = "";
  // Finnes i forskjellige varianter
  switch (variant) {
    case "small":
      baseClasses = "w-[140px] text-sm px-4 py-2";
      break;
    case "large":
      baseClasses = "w-[240px] text-xl px-8 py-4";
      break;
    case "iconOnly":
      baseClasses = "w-[48px] h-[48px] p-2 text-base"; 
      break;
    case "smallx":
      baseClasses = "w-[30px] h-[30px] p-2 text-base"; 
      break;
    case "normal":
      baseClasses ="w-48 h-12 text-lg px-4 py-2 text-center whitespace-nowrap overflow-hidden text-ellipsis";
      break;
    case "long":
        baseClasses = "w-[280px] h-14 text-lg px-4 py-2 text-center whitespace-nowrap overflow-hidden text-ellipsis";
        break;
      case "usual": // Denne brukes i friends-siden
        baseClasses = "w-[180px] h-14 text-lg px-4 py-2 text-center overflow-hidden whitespace-nowrap text-ellipsis";
        break;
    case "default":
    default:
      baseClasses = "w-[200px] text-lg px-6 py-3";
      break;
  }
  // Håndter klikk
  const handleClick = () => {
    if (onClick) {
      onClick();
    } else if (href) {
      router.push(href);
    }
  };


  return (
    <FormButton
      text={text}
      type="button"
      fullWidth={false}
      onClick={handleClick}
      disabled={disabled}
      className={`${baseClasses} ${className}`}
    />
  );
}