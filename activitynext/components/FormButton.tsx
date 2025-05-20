// Ferdig oppsatt knapp med flere muligheter for klikking, disabling etc. Brueks feks til ProfileNavButton som er en generall knapp
"use client";

import React from "react";
import clsx from "clsx";

export interface FormButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Tekst som vises når vi ikke er i loading */
  text: React.ReactNode;
  /** Loader-state */
  isSubmitting?: boolean;
  /** Tekst i loader-state */
  submittingText?: string;
  /** Kunne settes til "button" om du bruker knappen til annet enn form-submitt */
  type?: "button" | "submit";
  /** Full bredde? */
  fullWidth?: boolean;
}

const FormButton = React.forwardRef<HTMLButtonElement, FormButtonProps>(
  (
    {
      text,
      isSubmitting = false,
      submittingText = "Submitting...",
      type = "submit",
      fullWidth = true,
      disabled,
      className,
      // ...rest fanger opp onClick, aria-*, title, data-*, osv.
      ...rest
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        type={type}
        disabled={isSubmitting || disabled}
        className={clsx(
          fullWidth ? "w-1/2 mx-auto" : "",
          "bg-[#166016] text-white py-2 rounded-md font-semibold transition",
          isSubmitting
            ? "opacity-50 cursor-not-allowed"
            : "hover:bg-[#0F3D0F]",
          className
        )}
        {...rest}
      >
        {isSubmitting ? submittingText : text}
      </button>
    );
  }
);

FormButton.displayName = "FormButton";
export default FormButton;