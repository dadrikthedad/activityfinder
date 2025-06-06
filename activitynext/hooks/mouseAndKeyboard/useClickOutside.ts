// Gjenbrukbar hook som brukes til ved klik på utsiden av en dropdow, brukes til notifications og messagedropdown
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

      const clickedInsideInclude = includeRefs.some(
        (ref) => ref.current?.contains(targetElement)
      );
      const clickedInsideExclude = excludeRefs.some(
        (ref) => ref.current?.contains(targetElement)
      );
      const clickedExcludedByClass = excludeClassNames.some((selector) =>
        targetElement.closest(selector)
      );

         // 👇 Kun sjekk topp hvis vi fikk dropdownId
      const isThisDropdownTopmost = () => {
        if (!dropdownId) return true;
        const dropdowns = document.querySelectorAll("[data-dropdown-id]");
        return (
          dropdowns.length &&
          dropdowns[dropdowns.length - 1].getAttribute("data-dropdown-id") === dropdownId
        );
      };

      if (
        !clickedInsideInclude &&
        !clickedInsideExclude &&
        !clickedExcludedByClass &&
        isThisDropdownTopmost()
      ) {
        onOutsideClick();
      }
    };

    if (isActive) {
      document.addEventListener("mousedown", handleClick);
    }

    return () => {
      document.removeEventListener("mousedown", handleClick);
    };
  }, [includeRefs, excludeRefs, onOutsideClick, isActive, excludeClassNames, dropdownId, isModalOpen]);
}
