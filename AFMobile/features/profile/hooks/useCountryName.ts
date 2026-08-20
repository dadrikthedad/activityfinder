import { useState, useEffect } from 'react';
import { fetchCountries } from '@/features/auth/services/signUpService';

// Modul-nivå cache — hentes kun én gang per app-sesjon
let cachedMap: Record<string, string> | null = null;

export function useCountryName(isoCode: string | null | undefined): string {
  const [name, setName] = useState<string>(isoCode ?? '');

  useEffect(() => {
    if (!isoCode) return;

    if (cachedMap) {
      setName(cachedMap[isoCode] ?? isoCode);
      return;
    }

    fetchCountries().then((data) => {
      cachedMap = {};
      data.forEach((c) => { cachedMap![c.code] = c.name; });
      setName(cachedMap[isoCode] ?? isoCode);
    });
  }, [isoCode]);

  return name;
}
