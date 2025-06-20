// Tooltipwrapper med ProfileNavButton for lett bruk
import ProfileNavButton from "../settings/ProfileNavButton";
import React from "react";
import TooltipWrapper from "./TooltipWrapper";

interface TooltipButtonProps {
  icon: React.ReactNode;
  tooltip: string;
  onClick?: () => void;
  className?: string;
}

/**
 * TooltipButton - En knapp med tooltip som vises når bruker holder musepekeren over
 * 
 * @param {React.ReactNode} icon - Ikonet som skal vises på knappen
 * @param {string} tooltip - Teksten som skal vises i tooltipet
 * @param {function} onClick - Funksjonen som skal kjøres når knappen klikkes
 * @param {string} className - Ekstra CSS-klasser som skal legges til knappen
 */
export default function TooltipButton({ icon, tooltip, onClick, className }: TooltipButtonProps) {
  return (
    <TooltipWrapper tooltip={tooltip}>
      <ProfileNavButton 
        text={icon} 
        variant="tiny" 
        onClick={onClick} 
        className={className || "hover:bg-[#0F3D0F]"} 
        tabIndex={-1}
      />
    </TooltipWrapper>
  );
}