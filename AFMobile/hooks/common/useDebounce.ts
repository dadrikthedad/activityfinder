import { useState, useEffect } from "react";

/**
 * useDebounce tar imot en verdi `value` og en `delay` i millisekunder,
 * og returnerer en “debounce’et” versjon av `value` som først oppdaterer
 * seg når brukeren har sluttet å endre `value` i `delay` ms.
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    // Sett opp en timeout som oppdaterer "debouncedValue" etter `delay` ms
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    // Rydd opp (clearTimeout) hvis `value` endrer seg før delay er over
    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}
