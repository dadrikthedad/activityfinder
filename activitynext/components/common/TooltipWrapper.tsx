import React, { ReactNode } from "react";

interface TooltipWrapperProps {
  children: ReactNode;
  tooltip: string;
  className?: string;
}

/**
 * TooltipWrapper - En generell wrapper-komponent som legger til tooltip på hvilket som helst element
 * 
 * @param {ReactNode} children - Elementet som skal få tooltip
 * @param {string} tooltip - Teksten som skal vises i tooltipet
 * @param {string} className - Ekstra CSS-klasser for wrapper div
 */

export default function TooltipWrapper({ children, tooltip, className = "" }: TooltipWrapperProps) {
  return (
    <div className={`relative group ${className}`}>
      {children}
      <div className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 px-2 py-1 bg-[#2c2f30] text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap pointer-events-none border border-[#1C6B1C] z-50 shadow-lg">
        {tooltip}
      </div>
    </div>
  );
}