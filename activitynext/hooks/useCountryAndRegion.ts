// Her håndterer vi land og regionvalg til signup og editprofile, setter land ut ifra IP
import { useState, useEffect, useCallback, useRef } from "react";
import { SelectOption } from "@shared/types/select";
import { fetchCountries, fetchRegions } from "@/services/user";
import { FormDataType } from "@shared/types/form";

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

  const fetchInitialLocation = async () => { // Oppdatert geolocation med robust fallback
    try {
      // Prøv ipwhois.io først (10k/måned gratis, kommersielt bruk OK)
      const ipRes = await fetch("https://ipwho.is/", {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      });

      if (!ipRes.ok) {
        throw new Error(`HTTP error! status: ${ipRes.status}`);
      }

      const ipData = await ipRes.json();

      if (!ipData.success) {
        throw new Error('ipwhois.io returned unsuccessful response');
      }

      if (ipData?.country && !hasSetCountry.current) {
        hasSetCountry.current = true;
        setFormData((prev) => ({ ...prev, country: ipData.country })); // Full country name
        
        if (editing) {
          await fetchRegionsForCountry(ipData.country);
        }
        
        console.log(`✅ Country set from ipwhois.io: ${ipData.country}`);
        return; // Success, exit early
      }
    } catch (err) {
      console.warn("⚠️ ipwhois.io failed, trying fallback:", err);
      
      // Fallback til FreeIPAPI.com (60 requests/min, gratis)
      try {
        const fallbackRes = await fetch("https://freeipapi.com/api/json/");
        
        if (!fallbackRes.ok) {
          throw new Error(`FreeIPAPI HTTP error! status: ${fallbackRes.status}`);
        }
        
        const fallbackData = await fallbackRes.json();
        
        if (fallbackData?.countryName && !hasSetCountry.current) {
          hasSetCountry.current = true;
          setFormData((prev) => ({ ...prev, country: fallbackData.countryName }));
          
          if (editing) {
            await fetchRegionsForCountry(fallbackData.countryName);
          }
          
          console.log(`✅ Country set from FreeIPAPI: ${fallbackData.countryName}`);
          return; // Success, exit early
        }
      } catch (fallbackError) {
        console.warn("⚠️ FreeIPAPI also failed:", fallbackError);
        
        // Ultimate fallback - set Norge som default for norske brukere
        if (!hasSetCountry.current) {
          hasSetCountry.current = true;
          setFormData((prev) => ({ ...prev, country: "Norway" }));
          
          if (editing) {
            await fetchRegionsForCountry("Norway");
          }
          
          console.log("🇳🇴 Using default country: Norway");
        }
      }
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