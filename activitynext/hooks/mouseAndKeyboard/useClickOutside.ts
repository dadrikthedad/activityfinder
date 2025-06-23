// useClickOutsideGroups.ts - Fixed version for Portal contexts
import { useEffect } from "react";
import { useModal } from "@/context/ModalContext";

type RefGroup = React.RefObject<HTMLElement | null>[];

export function useClickOutsideGroups({
  includeRefs,
  excludeRefs = [],
  excludeClassNames = [],
  onOutsideClick,
  isActive,
  dropdownId,
}: {
  includeRefs: RefGroup;
  excludeRefs?: RefGroup;
  excludeClassNames?: string[];
  onOutsideClick: () => void;
  isActive: boolean;
  dropdownId?: string;
}) {
  const { isModalOpen } = useModal();

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (isModalOpen) return;
      
      const targetElement = event.target as HTMLElement;
      
      // ✅ Sjekk om klikket skjedde inne i include refs
      const clickedInsideInclude = includeRefs.some(
        (ref) => ref.current?.contains(targetElement)
      );
      
      // ✅ Sjekk om klikket skjedde inne i exclude refs
      const clickedInsideExclude = excludeRefs.some(
        (ref) => ref.current?.contains(targetElement)
      );
      
      // ✅ Sjekk excluded class names (for nested popovers, etc.)
      const clickedExcludedByClass = excludeClassNames.some((selector) =>
        targetElement.closest(selector)
      );

      // ✅ FORBEDRET: Sjekk for Portal-kontekster - ikke lukk hvis vi klikker i høyere z-index Portals
      const clickedInHigherZIndexPortal = () => {
        // Finn nærmeste portal-container med z-index
        let current = targetElement;
        while (current && current !== document.body) {
          const computedStyle = window.getComputedStyle(current);
          const zIndex = parseInt(computedStyle.zIndex);
          
          // Hvis vi finner et element med høyere z-index enn 1000 (main popover)
          // og det har portal-attributter, så ikke lukk
          if (
            zIndex > 1000 && 
            (current.hasAttribute('data-nested-user-popover') || 
             current.hasAttribute('data-nested-popover') ||
             current.hasAttribute('data-user-action-popover'))
          ) {
            return true;
          }
          current = current.parentElement as HTMLElement;
        }
        return false;
      };

      // ✅ Dropdown hierarchy check - bare utfør hvis dropdownId er gitt
      const isThisDropdownTopmost = () => {
        if (!dropdownId) return true;
        
        const dropdowns = document.querySelectorAll("[data-dropdown-id]");
        if (!dropdowns.length) return true;
        
        const lastDropdown = dropdowns[dropdowns.length - 1];
        return lastDropdown.getAttribute("data-dropdown-id") === dropdownId;
      };

      // ✅ Hovedlogikk: lukk kun hvis ALLE betingelser er oppfylt
      if (
        !clickedInsideInclude &&
        !clickedInsideExclude &&
        !clickedExcludedByClass &&
        !clickedInHigherZIndexPortal() &&
        isThisDropdownTopmost()
      ) {
        onOutsideClick();
      }
    };

    if (isActive) {
      // ✅ Bruk capture: true for å fange events før de når Portal-innhold
      document.addEventListener("mousedown", handleClick, { capture: true });
    }

    return () => {
      document.removeEventListener("mousedown", handleClick, { capture: true });
    };
  }, [includeRefs, excludeRefs, onOutsideClick, isActive, excludeClassNames, dropdownId, isModalOpen]);
}