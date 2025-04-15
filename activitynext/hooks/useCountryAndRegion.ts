// Her håndterer vi land og regionvalg til signup og editprofile, setter land ut ifra IP
import { useState, useEffect, useCallback, useRef } from "react";
import { SelectOption } from "@/types/select";
import { fetchCountries, fetchRegions } from "@/services/user";
import { FormDataType } from "@/types/form";

interface UseCountryAndRegionProps {
  country: string; // Her lagere vi landet
  setFormData: React.Dispatch<React.SetStateAction<FormDataType>>; 
  editing?: boolean; // Brukes for å hente regioner automatisk
}

export function useCountryAndRegion({
  setFormData,
  editing = false,
}: UseCountryAndRegionProps) {
  const [countries, setCountries] = useState<SelectOption[]>([]); // Liste med land til dropdownbosen
  const [regions, setRegions] = useState<SelectOption[]>([]);// Regioner for valgt land
  const [countryCodes, setCountryCodes] = useState<Record<string, string>>({}); // Vi må sende countrycode til API
  const [codesReady, setCodesReady] = useState(false); // Når vi er ferdig lastet
  const hasSetCountry = useRef(false); // Sjekk for å forhindre flere IP-hentinger

  const fetchCountriesFromAPI = async () => { // Henter land fra API
    const data = await fetchCountries();

    const countryOptions: SelectOption[] = data // Bygger dropdown og gjør om countryname til codes
      .map((country) => ({ label: country.name, value: country.name }))
      .sort((a, b) => a.label.localeCompare(b.label));

    setCountries(countryOptions);

    const codeMap: Record<string, string> = {};
    data.forEach((country) => {
      codeMap[country.name] = country.code;
    });

    setCountryCodes(codeMap);
    setCodesReady(true); // Markér at koder er klare
  };

  const fetchRegionsForCountry = useCallback( // Henter regioner fra backend med countrycode
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

  const fetchInitialLocation = async () => { // Her henter vi geolokasjon fra IP, brukes i frontend og ikke backend for en rask hent. Burde kanskje flyttes senere?
    try {
      const ipRes = await fetch("https://ipapi.co/json/");
      const ipData = await ipRes.json();
      if (ipData?.country_name && !hasSetCountry.current) {
        hasSetCountry.current = true;
        setFormData((prev) => ({ ...prev, country: ipData.country_name }));
        if (editing) {
          await fetchRegionsForCountry(ipData.country_name);
        }
      }
    } catch (err) {
      console.error("Feil ved henting av brukerland:", err);
    }
  };

  useEffect(() => { // Henter countries fra IP kun engang
    fetchCountriesFromAPI();
  }, []);

  useEffect(() => { // Bruker denne når countryCodes er klar
    if (Object.keys(countryCodes).length > 0) {
      fetchInitialLocation();
    }
  }, [countryCodes]);

  return {
    countries,
    regions,
    countryCodes,
    codesReady, // ✅ eksponert
    fetchRegionsForCountry,
    handleCountryChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const selected = e.target.value;
      setFormData((prev) => ({ ...prev, country: selected, region: "" }));
    },
  };
}
