// components/FormButton.tsx
import React from "react";

interface FormButtonProps {
  text: string;
  isSubmitting?: boolean;
  submittingText?: string;
  type?: "button" | "submit";
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
  fullWidth?: boolean;
  className?: string;
}

const FormButton: React.FC<FormButtonProps> = ({
  text,
  isSubmitting = false,
  submittingText = "Submitting...",
  type = "submit", // ✅ Default til submit
  onClick,
  disabled = false,
  fullWidth = true,
  className = "",
}) => {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={isSubmitting || disabled}
      className={`${
        fullWidth ? "w-1/2 mx-auto" : ""
      } bg-[#166016] text-white py-2 rounded-md font-semibold transition ${
        isSubmitting ? "opacity-50 cursor-not-allowed" : "hover:bg-[#0F3D0F]"
      } ${className || ""}`}
    >
      {isSubmitting ? submittingText : text}
    </button>
  );
};

export default FormButton;
