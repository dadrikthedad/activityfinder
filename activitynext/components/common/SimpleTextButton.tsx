"use client";
// En enkel knapp for ikoner som brukes i menyen i chat samt tilbakeknappen i chatdropdownen

import { ButtonHTMLAttributes, forwardRef, ReactNode } from "react";


interface SimpleTextButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    text?: string;
    children?: ReactNode;
  }

  const SimpleTextButton = forwardRef<HTMLButtonElement, SimpleTextButtonProps>(
    ({ text, children, className = "", ...props }, ref) => {
      return (
        <button
          ref={ref}
          type="button"
          {...props}
          className={`bg-[#1C6B1C] hover:bg-[#0F3D0F] text-white px-4 py-2 rounded text-sm ${className}`}
        >
          {children ?? text}
        </button>
      );
    }
  );

// For bedre debugging og unngå eslint warning
SimpleTextButton.displayName = "SimpleTextButton";

export default SimpleTextButton;