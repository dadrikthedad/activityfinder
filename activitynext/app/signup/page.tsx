"use client";// Use client bestemmer at vi skal kjøre i nettleseren(client) og ikke kun på serveren. Må være øverst før alle imports

// useSate gjør at vi kan lagre en "state", og det er verdier som kan endres. useEffect brukes til API-kall og events. Kjøres kun når vi mounter den og en når en effekt blir endret
// useRef lagrer referanser eller verdier uten rerender, bra for å telle noe eller timeout/invervals som ikkek skal miste veriden ved rerender.
// render betyr at react bygger og viser komponentene på skjermen. Det skjer når siden lastest og hvis vi endrer noe, feks trykker på en tast. 
import { useState, useEffect, useRef, useCallback } from "react";
// 
import { Info } from "lucide-react";
// Henter router slik at vi kan navigere til andre sider
import { useRouter } from "next/navigation";
// Popup vinduet vårt som sier at vi har hat suksess med innlogging
import SuccessModal from "@/components/SuccessModal";
import {
  FieldName
} from "@/utils/validators";
import { useFormHandlers } from "@/hooks/useFormHandlers";
import FormField from "@/components/FormField";
import PasswordField from "@/components/PasswordField";
import { SelectOption } from "@/types/select";


export default function Signup() {
  const {
    formData,
    errors,
    setErrors,
    touchedFields,
    handleChange,
    handleBlur,
    validateAllFields,
    message,
    setMessage,
    setFormData,
  } = useFormHandlers({
    firstName: "",
    middleName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
    phone: "",
    dateOfBirth: "",
    country: "",
    region: "",
    postalCode: "",
  });

  // countries er veriden som kan endres, setCountries brukes for å oppdatere verdien når den blir kalt
  const [countries, setCountries] = useState<SelectOption[]>([]);
  const [regions, setRegions] = useState<SelectOption[]>([]);
    const hasSetCountry = useRef(false); // 👈 Lagrer om vi allerede har satt landet
    const emailCheckTimeout = useRef<NodeJS.Timeout | null>(null);
    const [isRegistered, setIsRegistered] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false); // Sjekker om vi har submitta eller ikke
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const router = useRouter();
    const [ countryCodes, setCountryCodes ] = useState<Record<string, string>>({});
    


  
  //Hent land fra API
  const fetchCountries = async () => {
    try {
      const response = await fetch("https://activityfinder-gnaacbg9gsgjh7b7.swedencentral-01.azurewebsites.net/api/user/countries");
      const data: { code: string; name: string }[] = await response.json();
  
      const countryOptions: SelectOption[] = data
        .map((country) => ({
          label: country.name,
          value: country.name, // 👈 vi bruker navn som value i formData
        }))
        .sort((a, b) => a.label.localeCompare(b.label));
  
      setCountries(countryOptions);
  
      const codeMap: Record<string, string> = {};
      data.forEach((country) => {
        codeMap[country.name] = country.code;
      });
      setCountryCodes(codeMap);
    } catch (error) {
      console.error("Feil ved henting av land:", error);
    }
  };

  useEffect(() => {
    fetchCountries();
  }, []);

  useEffect(() => {
    if (emailCheckTimeout.current) clearTimeout(emailCheckTimeout.current);

    emailCheckTimeout.current = setTimeout(() => {
      checkEmailAvailability(formData.email);
    }, 500); // Vent 500ms før vi sjekker
  }, [formData.email]);


  // Håndterer og gir en error hvis ikke alt er fylt og vi klikker på submit
  const handleAttemptSubmit = async () => {
  const emailAvailable = await checkEmailAvailability(formData.email);
  if (!emailAvailable) {
    setMessage("E-posten er allerede registrert.");
    return; // 🚫 STOPP submit hvis e-post er opptatt
  }

  const isValid = validateAllFields();

  const isRegionValid =
    formData.region &&
    formData.region !== "null" &&
    formData.region !== "No regions available" &&
    formData.region !== "-- Choose --";

  const hasEmailError = !!errors.email;

  if (!isValid || !isRegionValid || hasEmailError) {
    setMessage("Please fix all required fields.");

    setErrors((prev) => ({
      ...prev,
      ...(isRegionValid ? {} : { region: "Region is required." }),
    }));

    return;
  }

  setMessage("");
  setIsSubmitting(true);
  registerUser(new Event("submit") as unknown as React.FormEvent);
};
  
  
  
  

  const checkEmailAvailability = useCallback(async (email: string): Promise<boolean> => {
    if (!email.trim() || !/^\S+@\S+\.\S+$/.test(email)) return false;
  
    try {
      const response = await fetch(
        `https://activityfinder-gnaacbg9gsgjh7b7.swedencentral-01.azurewebsites.net/api/user/check-email?email=${email}`
      );
      const data = await response.json();
  
      if (!response.ok) {
        throw new Error(data.message || "Kunne ikke sjekke e-post.");
      }
  
      if (data.exists) {
        setErrors((prevErrors) => ({
          ...prevErrors,
          email: "Denne e-posten er allerede registrert.",
        }));
        return false;
      } else {
        setErrors((prevErrors) => {
          const newErrors = { ...prevErrors };
          delete newErrors.email;
          return newErrors;
        });
        return true;
      }
    } catch (error) {
      console.error("Feil ved sjekking av e-post:", error);
      return false;
    }
  }, [setErrors]);

  //Hent IP fra API
  useEffect(() => {
    const fetchInitialLocationData = async () => {
      try {
        const ipRes = await fetch("https://ipapi.co/json/");
        const ipData = await ipRes.json();
  
        if (ipData?.country_name && !hasSetCountry.current) {
          hasSetCountry.current = true;
          const userCountry = ipData.country_name;
  
          setFormData((prev) => ({ ...prev, country: userCountry }));
          await fetchAndSetRegions(userCountry);
        }
      } catch (err) {
        console.error("Feil ved henting av brukerland:", err);
      }
    };
  
    if (Object.keys(countryCodes).length > 0) {
      fetchInitialLocationData();
    }
  }, [countryCodes]);
  
  
  

  const fetchAndSetRegions: (countryName: string) => Promise<void> = useCallback(async (countryName: string) => {
    const countryCode = countryCodes[countryName];
    if (!countryCode) {
      console.warn("Fant ikke landkode for:", countryName);
      setRegions([]);
      return;
    }
  
    try {
      const res = await fetch(
        `https://activityfinder-gnaacbg9gsgjh7b7.swedencentral-01.azurewebsites.net/api/user/regions/${encodeURIComponent(countryCode)}`
      );
      const data: string[] = await res.json();
  
      if (!Array.isArray(data)) {
        console.warn("Ugyldig regiondata:", data);
        setRegions([]);
        return;
      }
  
      const options = [
        { label: "-- Choose --", value: "" }, // 🛑 alltid først
        ...data.map((region) => ({ label: region, value: region })),
      ];
  
      setRegions(options);
      setFormData((prev) => ({ ...prev, region: "" })); // Tving bruker til å velge
    } catch (error) {
      console.error("Feil ved henting av regioner:", error);
      setRegions([]);
    }
  }, [formData.country, countryCodes,]);

  useEffect(() => {
    if (formData.country && countryCodes[formData.country]) {
      fetchAndSetRegions(formData.country);
    }
  }, [formData.country, countryCodes, fetchAndSetRegions]);

 // Håndterer valg av land
 const handleCountryChange = (
  e: React.ChangeEvent<HTMLSelectElement>
) => {
  const selectedCountryName = e.target.value;

  setFormData((prev) => ({
    ...prev,
    country: selectedCountryName,
    region: "", // alltid tving til å velge ny region
  }));
};





useEffect(() => {
  console.log("Akkurat nå, errors:", errors);
}, [errors]);



  

  const registerUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(""); 

    // Forhindrer flere klikk etter vi har klikket engang
    if (isSubmitting) return;
    setIsSubmitting(true);
    
    const payload: Partial<typeof formData> = {
      ...formData,
      country: countryCodes[formData.country] || formData.country, // 💡 fallback til name hvis noe går galt
    };

    if (!payload.phone || payload.phone.trim() === "") {
    delete payload.phone; // 🚀 Fjern phone-feltet hvis det er tomt
    }

    if (
      !formData.region ||
      formData.region === "null" ||
      formData.region === "No regions available" ||
      formData.region === "-- Choose --"
    ) {
      delete payload.region;
    }


      console.log("Data som sendes til backend:", JSON.stringify(payload, null, 2));


    try {
      const response = await fetch("https://activityfinder-gnaacbg9gsgjh7b7.swedencentral-01.azurewebsites.net/api/user/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
  
      const data = await response.json();
      if (response.ok) {
        setFormData({ firstName: "", middleName: "", lastName: "", email: "", password: "", confirmPassword: "", phone: "", dateOfBirth: "", country: "", region: "", postalCode: "" });
        setShowSuccessModal(true);
        setTimeout(() => {
          setShowSuccessModal(false);
          setIsRegistered(true); // 🚀 Oppdater state i stedet for å navigere direkte
        }, 1000);


      } else {
        setErrors(data.errors || { general: "Could not register user." });
      }
    } catch (error) {
      console.error("Feil under registrering:", error);
      setMessage("❌ Nettwork error. Try again later.");
    } finally
    {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    if (isRegistered) {
      setTimeout(() => {
        router.replace("/login");
      }, 1000);
    }
  }, [isRegistered, router]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6 py-12 text-center">
      <h1 className="text-4xl font-bold text-[#145214]">Register</h1>
      <p className="mt-4 text-lg text-gray-700 dark:text-gray-300">
        Create a new user.
      </p>
  
      <form onSubmit={registerUser} className="mt-6 grid grid-cols-3 gap-x-6 gap-y-4 items-center w-full max-w-2xl">
  
        {/* 🔥 FORNAVN */}

        <FormField
        id="firstName"
        label="First name:"
        value={formData.firstName}
        onChange={(e) => handleChange("firstName", e.target.value)}
        onBlur={() => handleBlur("firstName")}
        error={errors.firstName}
        touched={touchedFields.firstName}
        placeholder="First name"
        tooltip="Required: Your first name. Max characters: 50."
        />

        {/* 🔥 MELLOMNAVN */}
        <FormField
        id="middleName"
        label="Middle name:"
        value={formData.middleName}
        onChange={(e) => handleChange("middleName", e.target.value)}
        onBlur={() => handleBlur("middleName")}
        error={errors.middleName}
        touched={touchedFields.middleName}
        placeholder="Middle name (not required)"
        tooltip="Not required: Your middle name. Max characters: 50."
        />

        {/* 🔥 ETTERNAVN */}
        <FormField
        id="lastName"
        label="Last name:"
        value={formData.lastName}
        onChange={(e) => handleChange("lastName", e.target.value)}
        onBlur={() => handleBlur("lastName")}
        error={errors.lastName}
        touched={touchedFields.lastName}
        placeholder="Last name"
        tooltip="Required: Your last name. Max characters: 50."
        />

        {/* 🔥 E-POST */}
        <FormField
        id="email"
        label="Email:"
        type="email"
        value={formData.email}
        onChange={(e) => handleChange("email", e.target.value)}
        onBlur={() => handleBlur("email")}
        error={errors.email}
        touched={touchedFields.email}
        placeholder="Email"
        tooltip="Required: Email. Only one user per email. Max characters: 100."
        />

        {/* 🔥 Passowrd */}
        <PasswordField
        id="password"
        label="Password:"
        value={formData.password}
        onChange={(e) => handleChange("password", e.target.value)}
        onBlur={() => handleBlur("password")}
        error={errors.password}
        touched={touchedFields.password}
        placeholder="Password"
        tooltip="Password must contain uppercase, lowercase and a number. 8-128 chars."
        />
        {/* 🔥 ConfirmPassword */}
        <PasswordField
        id="confirmPassword"
        label="Confirm Password:"
        value={formData.confirmPassword}
        onChange={(e) => handleChange("confirmPassword", e.target.value)}
        onBlur={() => handleBlur("confirmPassword")}
        error={errors.confirmPassword}
        touched={touchedFields.confirmPassword}
        placeholder="Confirm Password"
        tooltip="Must match your password."
        />

        {/* 🔥 Phone */}
        <FormField
        id="phone"
        label="Telefonnummer (valgfritt):"
        type="tel"
        value={formData.phone}
        onChange={(e) => handleChange("phone", e.target.value)}
        onBlur={() => handleBlur("phone")}
        error={errors.phone}
        touched={touchedFields.phone}
        placeholder="Phonenumber"
        tooltip="Not required: Must be a valid phonenumber. Might be used for verification later."
        />

      {/* 🔥 FØDSELSDATO */}
      <label htmlFor="dateOfBirth" className="text-gray-300 font-medium text-right">Date of birth:</label>
        <div className="flex flex-col w-full">
          <input
            id ="dateOfBirth"
            type="date" 
            name="dateOfBirth" 
            value={formData.dateOfBirth} 
            onChange={(e) => handleChange(e.target.name as FieldName, e.target.value)}
            onBlur={(e) => handleBlur(e.target.name as FieldName)} // eller bruk en mer dynamisk metode
            max={new Date().toISOString().split("T")[0]}
            className={`w-full h-12 px-4 border rounded-md bg-gray-700 text-white 
              ${touchedFields.dateOfBirth && errors.dateOfBirth ? "border-red-500" : "border-gray-500"}`}
          />
          {touchedFields.dateOfBirth && errors.dateOfBirth && <p className="text-red-500 text-sm mt-1">{errors.dateOfBirth}</p>}
        </div>

        <div className="relative flex justify-start group">
        <Info className="text-gray-400 cursor-pointer" size={18} />

        {/* 🛠️ Tooltip som holder seg synlig */}
        <div className="absolute left-6 bottom-full mb-2 hidden group-hover:flex 
            bg-gray-800 text-white text-xs p-2 rounded-md shadow-md w-40 z-10">
          Required: Date of birth. Required for age verification.
        </div>
      </div>

        {/* 🔥 LAND */}
        <FormField
        id="country"
        label="Country:"
        value={formData.country}
        onChange={handleCountryChange}
        error={errors.country}
        touched={touchedFields.country}
        tooltip="Required: Country. Required to follow the law."
        as="select"
        options={countries}
        placeholder="Select a country"
        />

        {/* 🔥 REGION */}
        <FormField
        id="region"
        label="Region:"
        value={formData.region}
        onChange={(e) => handleChange("region", e.target.value)}
        error={errors.region}
        touched={touchedFields.region}
        tooltip="Required: Region. For updates in your region."
        as="select"
        options={regions}
        disabled={!formData.country}
        />
    
        {/* 🔥 PostalCode */}
        <FormField
          id="postalCode"
          label="Postal code:"
          value={formData.postalCode}
          onChange={(e) => handleChange("postalCode", e.target.value)}
          onBlur={() => handleBlur("postalCode")}
          error={errors.postalCode}
          touched={touchedFields.postalCode}
          placeholder="Postal code (not required)"
          tooltip="Not required: For updates/activities in your local area. Might use GPS later."
          />

          {/* 🔥 SIGN UP BUTTON */}
          <div className="col-span-3 flex flex-col items-center mt-4 space-y-2">
          {(message || errors["general"]) && (
          <div className="text-sm text-center">
            {message && <p className="text-red-500">{message}</p>}
            {errors["general"] && <p className="text-red-500">{errors["general"]}</p>}
          </div>
        )}
        
        <button
          type="button"
          className="w-full max-w-sm h-12 bg-[#166016] text-white rounded-lg font-semibold hover:bg-[#0F3D0F] transition"
          onClick={handleAttemptSubmit}
          disabled={isSubmitting}
        >
          {isSubmitting ? "Submitting..." : "Sign up"}
        </button>
      </div>
      
  </form>
  {showSuccessModal && <SuccessModal onClose={() => setShowSuccessModal(false)} />}
    </div>
  );
  
}