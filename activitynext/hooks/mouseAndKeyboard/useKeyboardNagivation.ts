import { useEffect, useState } from "react";

export function useKeyboardNavigation<T>(
  items: T[],
  onSelect: (item: T) => void,
  isActive: boolean = true
) {
  const [activeIndex, setActiveIndex] = useState(-1);

  useEffect(() => {
    if (!isActive) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (items.length === 0) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((prev) => (prev + 1) % items.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((prev) => (prev - 1 + items.length) % items.length);
      } else if (e.key === "Enter" && activeIndex >= 0) {
        e.preventDefault();
        onSelect(items[activeIndex]);
      } else if (e.key === "Escape") {
        setActiveIndex(-1);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [items, activeIndex, isActive, onSelect]);

  return { activeIndex, setActiveIndex };
}
