"use client";
import { useState, useEffect, useRef } from "react";
import { Info, Eye, EyeOff } from "lucide-react";
import { useRouter } from "next/navigation";
import SuccessModal from "@/components/SuccessModal";
import {
  validateFirstName,
  validateMiddleName,
  validateLastName,
  validateEmail,
  validatePhone,
  validatePassword,
  validateConfirmPassword,
  validateDateOfBirth,
  validateCountry,
  validateRegion,
  validatePostalCode,
  validateSingleField,
  FieldName
} from "@/utils/validators";
import { useFormHandlers } from "@/hooks/useFormHandlers";
import FormField from "@/components/FormField";
import PasswordField from "@/components/PasswordField";


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
    resetForm,
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

    const [countries, setCountries] = useState<string[]>([]);
    const [regions, setRegions] = useState<string[]>([]);
    const hasSetCountry = useRef(false); // 👈 Lagrer om vi allerede har satt landet
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const emailCheckTimeout = useRef<NodeJS.Timeout | null>(null);
    const [isRegistered, setIsRegistered] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false); // Sjekker om vi har submitta eller ikke
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const router = useRouter();
    const [ countryCodes, setCountryCodes ] = useState<Record<string, string>>({});


  
  //Hent land fra API
  const fetchCountries = async () => {
    try {
      const response = await fetch("https://restcountries.com/v3.1/all");
      const data: { name: { common: string }, cca2: string }[] = await response.json();
  
      const countryMap: Record<string, string> = {};
      const countryNames = data.map((country) => {
        countryMap[country.name.common] = country.cca2;
        return country.name.common;
      }).sort();
  
      setCountries(countryNames);
      setCountryCodes(countryMap);
    } catch (error) {
      console.error("Feil ved henting av land:", error);
    }
  };
  
  const toggleConfirmPasswordVisibility = () => {
    setShowConfirmPassword((prev) => !prev);
  };
  
  // Sjekker om passordene matcher live

  useEffect(() => {
    if (!formData.email.trim() || !/^\S+@\S+\.\S+$/.test(formData.email)) return;

    if (emailCheckTimeout.current) clearTimeout(emailCheckTimeout.current);

    emailCheckTimeout.current = setTimeout(() => {
      checkEmailAvailability(formData.email);
    }, 500); // Vent 500ms før vi sjekker
  }, [formData.email]);


  // Håndterer og gir en error hvis ikke alt er fylt og vi klikker på submit
  const handleAttemptSubmit = () => {
    const isValid = validateAllFields();
  
    if (!isValid) {
      setMessage("Please fix all required fields.");
      return;
    }
  
    setMessage("");
    setIsSubmitting(true);
    registerUser(new Event("submit") as unknown as React.FormEvent);
  };
  
  
  
  

  const checkEmailAvailability = async (email: string) => {
    if (!email.trim() || !/^\S+@\S+\.\S+$/.test(email)) return; // Ikke sjekk hvis e-post er tom eller ugyldig
  
    try {
      const response = await fetch(`https://activityfinder-gnaacbg9gsgjh7b7.swedencentral-01.azurewebsites.net/api/user/check-email?email=${email}`);
      const data = await response.json();
  
      if (!response.ok) {
        throw new Error(data.message || "Kunne ikke sjekke e-post.");
      }
  
      if (data.exists) {
        setErrors((prevErrors) => ({
          ...prevErrors,
          email: "Denne e-posten er allerede registrert.",
        }));
      } else {
        setErrors((prevErrors) => {
          const newErrors = { ...prevErrors };
          delete newErrors.email; // ✅ Fjerner feilmeldingen hvis e-posten ikke finnes
          return newErrors;
        });
      }
    } catch (error) {
      console.error("Feil ved sjekking av e-post:", error);
    }
  };

  //Hent IP fra API
  useEffect(() => {
  const fetchUserCountry = async () => {
    try {
      const response = await fetch("https://ipapi.co/json/");
      const data = await response.json();
      
      if (data && data.country_name && !hasSetCountry.current) {
        hasSetCountry.current = true;
        setFormData((prev) => ({ ...prev, country: data.country_name }));
      }
    } catch (error) {
      console.error("Kunne ikke hente brukerens land:", error);
    }
  };

  fetchUserCountry();
}, []);

 // Håndterer valg av land
 const handleCountryChange = (
  e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
) => {
  const selectedCountry = e.target.value;
  const countryCode = countryCodes[selectedCountry];

  setFormData({ ...formData, country: selectedCountry, region: "" });

  if (!countryCode) {
    console.error("Fant ikke landkode for", selectedCountry);
    setRegions([]);
    return;
  }

  fetch(`https://activityfinder-gnaacbg9gsgjh7b7.swedencentral-01.azurewebsites.net/api/user/regions/${encodeURIComponent(countryCode)}`)
    .then((res) => res.json())
    .then((data) => {
      if (!Array.isArray(data)) {
        console.error("Ugyldig respons fra region-endepunktet:", data);
        setRegions([]);
        setFormData((prev) => ({ ...prev, region: "" }));
        return;
      }

      if (data.length === 0) {
        setRegions(["No regions available"]);
        setFormData((prev) => ({ ...prev, region: "No regions available" }));
      } else {
        setRegions(data);
        setFormData((prev) => ({
          ...prev,
          region: data[0],
        }));
      }
    })
    .catch((error) => {
      console.error("Feil ved henting av regioner:", error);
      setRegions([]);
      setFormData((prev) => ({ ...prev, region: "" }));
    });
};




useEffect(() => {
  console.log("Akkurat nå, errors:", errors);
}, [errors]);


  useEffect(() => {
    if (!formData.country) return;
    const fetchRegions = async () => {
      try {
        const countryCode = countryCodes[formData.country];
        if (!countryCode) return;

        const res = await fetch(`https://activityfinder-gnaacbg9gsgjh7b7.swedencentral-01.azurewebsites.net/api/user/regions/${encodeURIComponent(countryCode)}`)

        if (!res.ok) throw new Error("Kunne ikke hente regioner.");

        const data = await res.json();
        setRegions(data);
      } catch (error) {
        console.error("Feil ved henting av regioner:", error);
        setRegions([]);
      }
    };

    if (formData.country)
    {
      fetchRegions();
    }

  }, [formData.country]);



  

  const registerUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(""); 

    // Forhindrer flere klikk etter vi har klikket engang
    if (isSubmitting) return;
    setIsSubmitting(true);
    
    const payload: Partial<typeof formData> = { ...formData };

    if (!payload.phone || payload.phone.trim() === "") {
    delete payload.phone; // 🚀 Fjern phone-feltet hvis det er tomt
    }

    if (!formData.region || formData.region === "null" || formData.region === "No regions available") {
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
        onBlur={(e) => handleBlur("firstName")}
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
        onBlur={(e) => handleBlur("middleName")}
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
        onBlur={(e) => handleBlur("lastName")}
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
        onBlur={(e) => handleBlur("email")}
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
        onBlur={(e) => handleBlur("password")}
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
        onBlur={(e) => handleBlur("confirmPassword")}
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
        onBlur={(e) => handleBlur("phone")}
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
        disabled={countries.length === 0}
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
          onBlur={(e) => handleBlur("postalCode")}
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