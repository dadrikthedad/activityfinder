// Ferdig oppsatt knapp med flere muligheter for klikking, disabling etc. Brueks feks til ProfileNavButton som er en generall knapp
import React from "react";
// Grensesnittet vi må følge
interface FormButtonProps {
  text: string; //Tekst som vises når vi ikk er i loading
  isSubmitting?: boolean; // Sjekker om knappen er i loading tilstand
  submittingText?: string; // Teksten som kommer hvis vi er i loading
  type?: "button" | "submit"; //Knapp for å submitte og hvis det er en vanlig knapp
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void; //Klikkfunksjon hvis vi bruker knappen som en vanlig trykkeknapp
  disabled?: boolean; // Deaktiverer knappen hvis det trenges (feks etter submitting)
  fullWidth?: boolean; // Bruker for å sette knappen i stor størrelse eller ikke
  className?: string; // Kan endre knappen med forskjellige stylinger hvis det rengs
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
