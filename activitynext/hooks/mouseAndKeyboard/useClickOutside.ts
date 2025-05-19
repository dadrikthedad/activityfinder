// Gjenbrukbar hook som brukes til ved klik på utsiden av en dropdow, brukes til notifications og messagedropdown
import { useEffect } from "react";

type RefGroup = React.RefObject<HTMLElement | null>[];

export function useClickOutsideGroups({
  includeRefs,
  excludeRefs = [],
  onOutsideClick,
  isActive
}: {
  includeRefs: RefGroup;
  excludeRefs?: RefGroup;
  onOutsideClick: () => void;
  isActive: boolean;
}) {
  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const target = event.target as Node;

      const clickedInsideInclude = includeRefs.some(
        (ref) => ref.current?.contains(target)
      );
      const clickedInsideExclude = excludeRefs.some(
        (ref) => ref.current?.contains(target)
      );

      // Hvis du klikker utenfor hovedinnholdet og ikke på et ekskludert element
      if (!clickedInsideInclude && !clickedInsideExclude) {
        onOutsideClick();
      }
    };

    if (isActive) {
      document.addEventListener("mousedown", handleClick);
    }

    return () => {
      document.removeEventListener("mousedown", handleClick);
    };
  }, [includeRefs, excludeRefs, onOutsideClick, isActive]);
}
