// Hovedknappen som finnes rundt omkring, arver fra FormButton og finnes i forskjellige varianter. Brukes i profilesettings, profile/[id], editprofile osv
"use client";

import React from "react";
import { useRouter } from "next/navigation";
import FormButton from "@/components/FormButton";
import clsx from "clsx";

// Her arver vi alle vanlige knapp-props og legger til våre egne
export interface ProfileNavButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "type"> {
  href?: string;
  text: React.ReactNode;
  variant?:
    | "default"
    | "small"
    | "large"
    | "long"
    | "normal"
    | "usual"
    | "iconOnly"
    | "smallx"
    | "tiny";
}

const ProfileNavButton = React.forwardRef<
  HTMLButtonElement,
  ProfileNavButtonProps
>(
  (
    {
      href,
      text,
      onClick,
      disabled = false,
      className = "",
      variant = "default",
      // fanger opp ALT annet du måtte sende, inkl. aria-* etc
      ...rest
    },
    ref
  ) => {
    const router = useRouter();

    // Sett opp base‐klasser som før
    let baseClasses = "";
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
        baseClasses =
          "w-48 h-12 text-lg px-4 py-2 text-center whitespace-nowrap overflow-hidden text-ellipsis";
        break;
      case "long":
        baseClasses =
          "w-[280px] h-14 text-lg px-4 py-2 text-center whitespace-nowrap overflow-hidden text-ellipsis";
        break;
      case "usual":
        baseClasses =
          "w-[180px] h-14 text-lg px-4 py-2 text-center overflow-hidden whitespace-nowrap text-ellipsis";
        break;
      case "tiny":
        baseClasses = "w-[28px] h-[28px] p-1 flex items-center justify-center text-sm";
        break;
      default:
        baseClasses = "w-[200px] text-lg px-6 py-3";
    }

    // Slå sammen klasser
    const classes = clsx(baseClasses, className);

    // Samle klikk‐håndtering
    const handleClick: React.MouseEventHandler<HTMLButtonElement> = (e) => {
      if (href) {
        router.push(href);
      }
      if (onClick) {
        onClick(e);
      }
    };

    return (
      <FormButton
        // Viktig: forward ref og spre resten av props
        ref={ref}
        type="button"
        fullWidth={false}
        text={text}
        onClick={handleClick}
        disabled={disabled}
        className={classes}
        {...rest}
      />
    );
  }
);

ProfileNavButton.displayName = "ProfileNavButton";
export default ProfileNavButton;