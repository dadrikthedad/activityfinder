import { useState, useEffect, useCallback, useRef } from "react";
import { SelectOption } from "@/types/select";
import { fetchCountries, fetchRegions } from "@/services/user";
import { FormDataType } from "@/types/form";

interface UseCountryAndRegionProps {
  country: string;
  setFormData: React.Dispatch<React.SetStateAction<FormDataType>>;
}

export function useCountryAndRegion({ country, setFormData }: UseCountryAndRegionProps) {
  const [countries, setCountries] = useState<SelectOption[]>([]);
  const [regions, setRegions] = useState<SelectOption[]>([]);
  const [countryCodes, setCountryCodes] = useState<Record<string, string>>({});
  const hasSetCountry = useRef(false);

  // Hent land + bygg countryCodes
  const fetchCountriesFromAPI = async () => {
    const data = await fetchCountries();

    const countryOptions: SelectOption[] = data
      .map((country) => ({ label: country.name, value: country.name }))
      .sort((a, b) => a.label.localeCompare(b.label));

    setCountries(countryOptions);

    const codeMap: Record<string, string> = {};
    data.forEach((country) => {
      codeMap[country.name] = country.code;
    });
    setCountryCodes(codeMap);
  };

  const fetchAndSetRegions = useCallback(
    async (countryName: string) => {
      const code = countryCodes[countryName];
      if (!code) return setRegions([]);

      const data = await fetchRegions(code);
      const regionOptions = [
        { label: "-- Choose --", value: "" },
        ...data.map((r) => ({ label: r, value: r })),
      ];
      setRegions(regionOptions);
      setFormData((prev) => ({ ...prev, region: "" }));
    },
    [countryCodes, setFormData]
  );

  // Automatisk forhåndsutfyll fra IP
  const fetchInitialLocation = async () => {
    try {
      const ipRes = await fetch("https://ipapi.co/json/");
      const ipData = await ipRes.json();
      if (ipData?.country_name && !hasSetCountry.current) {
        hasSetCountry.current = true;
        setFormData((prev) => ({ ...prev, country: ipData.country_name }));
        await fetchAndSetRegions(ipData.country_name);
      }
    } catch (err) {
      console.error("Feil ved henting av brukerland:", err);
    }
  };

  // useEffects
  useEffect(() => {
    fetchCountriesFromAPI();
  }, []);

  useEffect(() => {
    if (country && countryCodes[country]) {
      fetchAndSetRegions(country);
    }
  }, [country, countryCodes, fetchAndSetRegions]);

  useEffect(() => {
    if (Object.keys(countryCodes).length > 0) {
      fetchInitialLocation();
    }
  }, [countryCodes]);

  return {
    countries,
    regions,
    countryCodes,
    handleCountryChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const selected = e.target.value;
      setFormData((prev) => ({ ...prev, country: selected, region: "" }));
    },
  };
}