import { useEffect, useRef, useState } from "react";

export function useKeyboardNavigableList<T>(
  items: T[],
  onSelect: (item: T) => void,
  isActive: boolean = true
) {
  const [activeIndex, setActiveIndex] = useState(-1);
  const itemRefs = useRef<(HTMLElement | null)[]>([]);

  // Scroll aktivt element inn i view
  useEffect(() => {
    const el = itemRefs.current[activeIndex];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [activeIndex]);

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

  const setItemRef = (index: number) => (el: HTMLElement | null) => {
    itemRefs.current[index] = el;
  };

  return { activeIndex, setActiveIndex, setItemRef };
}
