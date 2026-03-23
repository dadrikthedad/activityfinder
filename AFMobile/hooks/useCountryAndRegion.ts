// hooks/useCountryAndRegion.ts
// Håndterer land og regionvalg til signup og editprofile, setter land ut ifra IP
import { useState, useEffect, useCallback, useRef } from "react";
import { SelectOption } from "@shared/types/select";
import { fetchCountries, fetchRegions } from "@/features/auth/services/signUpService";
import { FormDataType } from "@shared/types/form";
import { getDialCode, DialCodeEntry } from "@/core/data/phoneDialCodes";

interface UseCountryAndRegionProps {
  country: string;
  setFormData: React.Dispatch<React.SetStateAction<FormDataType>>;
  editing?: boolean;
}

export function useCountryAndRegion({
  country,
  setFormData,
  editing = false,
}: UseCountryAndRegionProps) {
  const [countries, setCountries] = useState<SelectOption[]>([]);
  const [regions, setRegions] = useState<SelectOption[]>([]);
  const [countryCodes, setCountryCodes] = useState<Record<string, string>>({});
  const [codesReady, setCodesReady] = useState(false);
  const [dialCode, setDialCode] = useState<DialCodeEntry>({ dialCode: "+47", flag: "🇳🇴" });
  const hasSetCountry = useRef(false);

  const fetchCountriesFromAPI = async () => {
    const data = await fetchCountries();
    const countryOptions: SelectOption[] = data
      .map((c) => ({ label: c.name, value: c.name }))
      .sort((a, b) => a.label.localeCompare(b.label));

    setCountries(countryOptions);

    const codeMap: Record<string, string> = {};
    data.forEach((c) => { codeMap[c.name] = c.code; });
    setCountryCodes(codeMap);
    setCodesReady(true);
  };

  const fetchRegionsForCountry = useCallback(
    async (countryName: string) => {
      const code = countryCodes[countryName];
      if (!code) {
        console.warn("❌ Mangler ISO-kode for:", countryName);
        setRegions([]);
        return;
      }

      try {
        const data = await fetchRegions(code);
        const regionOptions = [
          { label: "-- Choose --", value: "" },
          ...data.map((r) => ({ label: r, value: r })),
        ];
        setRegions(regionOptions);
      } catch (err) {
        console.error("❌ Kunne ikke hente regioner:", err);
        setRegions([]);
      }
    },
    [countryCodes]
  );

  const fetchInitialLocation = async () => {
    try {
      const ipRes = await fetch("https://ipwho.is/", {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
      });

      if (!ipRes.ok) throw new Error(`HTTP error! status: ${ipRes.status}`);

      const ipData = await ipRes.json();
      if (!ipData.success) throw new Error('Location API returned unsuccessful response');

      if (ipData?.country && !hasSetCountry.current) {
        hasSetCountry.current = true;
        setFormData((prev) => ({ ...prev, country: ipData.country }));
        if (editing) await fetchRegionsForCountry(ipData.country);
      }
    } catch (err) {
      console.warn("ipwhois.io failed, trying fallback:", err);

      try {
        const fallbackRes = await fetch("https://freeipapi.com/api/json/");
        const fallbackData = await fallbackRes.json();

        if (fallbackData?.countryName && !hasSetCountry.current) {
          hasSetCountry.current = true;
          setFormData((prev) => ({ ...prev, country: fallbackData.countryName }));
          if (editing) await fetchRegionsForCountry(fallbackData.countryName);
        }
      } catch (fallbackError) {
        console.error("All geolocation services failed:", fallbackError);
        if (!hasSetCountry.current) {
          hasSetCountry.current = true;
          setFormData((prev) => ({ ...prev, country: "Norway" }));
          if (editing) await fetchRegionsForCountry("Norway");
        }
      }
    }
  };

  // Oppdater dialCode automatisk når valgt land endres
  useEffect(() => {
    if (!country || Object.keys(countryCodes).length === 0) return;
    const isoCode = countryCodes[country];
    if (isoCode) {
      setDialCode(getDialCode(isoCode));
    }
  }, [country, countryCodes]);

  useEffect(() => {
    fetchCountriesFromAPI();
  }, []);

  useEffect(() => {
    if (Object.keys(countryCodes).length > 0) {
      fetchInitialLocation();
    }
  }, [countryCodes]);

  return {
    countries,
    regions,
    countryCodes,
    codesReady,
    dialCode,
    fetchRegionsForCountry,
  };
}
