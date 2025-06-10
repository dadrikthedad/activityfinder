"use client";

import React, { ReactNode, useRef, useState, useEffect } from "react";
import { createPortal } from "react-dom";

interface TooltipWrapperProps {
  children: ReactNode;
  tooltip: string;
  className?: string;
  disabled?: boolean; 
}

export default function TooltipWrapper({ children, tooltip, className = "", disabled }: TooltipWrapperProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const wrapperRef = useRef<HTMLDivElement>(null);
  

  const updatePosition = () => {
    if (!wrapperRef.current) return;
    
    const rect = wrapperRef.current.getBoundingClientRect();
    const tooltipHeight = 32; // Estimert høyde på tooltip
    const tooltipWidth = tooltip.length * 8; // Estimert bredde basert på tekst
    
    let x = rect.left + rect.width / 2;
    let y = rect.top - tooltipHeight - 8;
    
    // Juster hvis tooltip går utenfor viewport
    if (x - tooltipWidth / 2 < 10) {
      x = tooltipWidth / 2 + 10;
    } else if (x + tooltipWidth / 2 > window.innerWidth - 10) {
      x = window.innerWidth - tooltipWidth / 2 - 10;
    }
    
    // Hvis ikke plass over, vis under
    if (y < 10) {
      y = rect.bottom + 8;
    }
    
    setPosition({ x, y });
  };

  const handleMouseEnter = () => {
    if (disabled) return;
    updatePosition();
    setIsVisible(true);
  };

  const handleMouseLeave = () => {
    setIsVisible(false);
  };

  const handleClick = () => {
    setIsVisible(false);
  };

  useEffect(() => {
    const handleScroll = () => {
      if (isVisible) {
        updatePosition();
      }
    };

    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', handleScroll);
    
    return () => {
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleScroll);
    };
  }, [isVisible]);

  const tooltipElement = isVisible ? (
    <div
      className="fixed px-2 py-1 bg-[#2c2f30] text-white text-xs rounded whitespace-nowrap pointer-events-none border border-[#1C6B1C] z-[9999] shadow-lg transition-opacity duration-200"
      style={{
        left: position.x,
        top: position.y,
        transform: 'translateX(-50%)',
      }}
    >
      {tooltip}
    </div>
  ) : null;

  return (
    <>
      <div
        ref={wrapperRef}
        className={`${className}`}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
      >
        {children}
      </div>
      {tooltipElement && createPortal(tooltipElement, document.body)}
    </>
  );
}