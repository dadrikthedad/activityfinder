// hooks/useDropdownState.ts
import { useState, useEffect } from "react";
import { useDropdown } from "@/context/DropdownContext";
import { useClickOutsideGroups } from "@/hooks/mouseAndKeyboard/useClickOutside";
import { useKeyboardNavigableList } from "../mouseAndKeyboard/useKeyboardForDropdown";

interface UseDropdownStateOptions<T = unknown> { // ✅ Endre fra 'any' til 'unknown'
  id: string;
  includeRefs: React.RefObject<HTMLElement | null>[];
  excludeRefs?: React.RefObject<HTMLElement | null>[];
  excludeClassNames?: string[];
  onClose?: () => void;
  // Keyboard navigation options
  items?: T[];
  onSelectItem?: (item: T) => void;
  enableKeyboardNavigation?: boolean;
  useClickOutside?: boolean;
}

export function useDropdownState<T = unknown>({ // ✅ Endre fra 'any' til 'unknown'
  id,
  includeRefs,
  excludeRefs = [],
  excludeClassNames = [],
  onClose,
  items = [],
  onSelectItem,
  enableKeyboardNavigation = false,
  useClickOutside = true,
}: UseDropdownStateOptions<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownContext = useDropdown();

  // ✅ Integrer keyboard navigation
  const keyboardNav = useKeyboardNavigableList(
    items,
    (item: T) => {
      onSelectItem?.(item);
      close(); // Lukk dropdown etter valg
    },
    isOpen && enableKeyboardNavigation
  );

  // ESC key handling via DropdownContext (men ikke hvis keyboard nav håndterer det)
  useEffect(() => {
    if (!isOpen) return;
    
    const close = () => {
      setIsOpen(false);
      onClose?.();
      // ✅ Reset keyboard navigation ved lukking
      if (enableKeyboardNavigation) {
        keyboardNav.setActiveIndex(-1);
      }
    };
    
    dropdownContext.register({ id, close });
    return () => dropdownContext.unregister(id);
  }, [isOpen, id, dropdownContext, onClose, enableKeyboardNavigation, keyboardNav]);

  // Outside click handling
    useClickOutsideGroups({
    includeRefs,
    excludeRefs,
    excludeClassNames,
    onOutsideClick: () => {
      setIsOpen(false);
      onClose?.();
      if (enableKeyboardNavigation) {
        keyboardNav.setActiveIndex(-1);
      }
    },
    isActive: isOpen && useClickOutside, // ✅ Only hvis useClickOutside er true
    dropdownId: id,
  });

  const toggle = () => setIsOpen(prev => !prev);
  const open = () => setIsOpen(true);
  const close = () => {
    setIsOpen(false);
    onClose?.();
    if (enableKeyboardNavigation) {
      keyboardNav.setActiveIndex(-1);
    }
  };

  return { 
    isOpen, 
    toggle, 
    open, 
    close,
    // ✅ Expose keyboard navigation
    ...(enableKeyboardNavigation && {
      activeIndex: keyboardNav.activeIndex,
      setItemRef: keyboardNav.setItemRef,
      setActiveIndex: keyboardNav.setActiveIndex,
    })
  };
}