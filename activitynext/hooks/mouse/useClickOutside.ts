// Gjenbrukbar hook som brukes til ved klik på utsiden av en dropdow, brukes til notifications og messagedropdown
import { useEffect } from "react";

export function useClickOutside(
  refs: Array<React.RefObject<HTMLElement | null>> | React.RefObject<HTMLElement | null>,
  callback: () => void,
  isActive: boolean
) {
  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const refArray = Array.isArray(refs) ? refs : [refs];

      const clickedInside = refArray.some(
        (ref) => ref.current && ref.current.contains(event.target as Node)
      );

      if (!clickedInside) {
        callback();
      }
    };

    if (isActive) {
      document.addEventListener("mousedown", handleClick);
    }

    return () => {
      document.removeEventListener("mousedown", handleClick);
    };
  }, [refs, callback, isActive]);
}