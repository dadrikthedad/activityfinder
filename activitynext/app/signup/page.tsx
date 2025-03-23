"use client";
import { useState, useEffect, useRef } from "react";
import { Info, Eye, EyeOff } from "lucide-react";
import { useRouter } from "next/navigation";
import SuccessModal from "@/components/SuccessModal";


export default function Signup() {
  const [formData, setFormData] = useState({
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

    const router = useRouter();
    const [errors, setErrors] = useState<{ [key: string]: string }>({});
    const [message, setMessage] = useState("");
    const [countries, setCountries] = useState<string[]>([]);
    const [regions, setRegions] = useState<string[]>([]);
    const hasSetCountry = useRef(false); // 👈 Lagrer om vi allerede har satt landet
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const emailCheckTimeout = useRef<NodeJS.Timeout | null>(null);
    const [isRegistered, setIsRegistered] = useState(false);
    const [touchedFields, setTouchedFields] = useState<{ [key: string]: boolean }>({});
    const [isSubmitting, setIsSubmitting] = useState(false); // Sjekker om vi har submitta eller ikke
    const [showSuccessModal, setShowSuccessModal] = useState(false);


  
  //Hent land fra API
  useEffect(() => {
    const fetchCountries = async () => {
      try {
        const response = await fetch("https://restcountries.com/v3.1/all");
        const data: { name: { common: string } }[] = await response.json(); // Spesifiserer forventet responsstruktur
        const countryNames = data.map((country) => country.name.common).sort();
        setCountries(countryNames);
      } catch (error) {
        console.error("Feil ved henting av land:", error);
      }
    };
  
    fetchCountries();
  }, []);

  const togglePasswordVisibility = () => {
    setShowPassword((prev) => !prev);
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

  const handleBlur = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setTouchedFields((prev) => ({ ...prev, [name]: true }));
  
    const error = validateSingleField(name, value);
    setErrors((prevErrors) => ({
      ...prevErrors,
      [name]: error || "",
    }));
  };

  // Håndterer og gir en error hvis ikke alt er fylt og vi klikker på submit
  const handleAttemptSubmit = () => {
    const allTouched = Object.keys(formData).reduce((acc, key) => {
      acc[key] = true;
      return acc;
    }, {} as { [key: string]: boolean });
  
    setTouchedFields(allTouched);
  
    const newErrors: { [key: string]: string } = {};
  
    for (const [key, value] of Object.entries(formData)) {
      if (key !== "middleName" && key !== "phone" && key !== "postalCode") {
        const error = validateSingleField(key, value);
        if (error) {
          newErrors[key] = error;
        }
      }
    }
  
    setErrors(newErrors);
  
    if (Object.keys(newErrors).length > 0) {
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


  // Funksjon for å validere ett enkelt felt
  const validateSingleField = (name: string, value: string): string | null => {
    if (name === "firstName") {
      if (!value.trim()) return "First name is required.";
      if (value.length > 50) return "First name can't be more than 50 characters.";
    }
  
    if (name === "middleName") {
      if (value.trim() && value.length > 50) return "Middle name can't be more than 50 characters.";
    }
  
    if (name === "lastName") {
      if (!value.trim()) return "Last name is required.";
      if (value.length > 50) return "Last name can't be more than 50 characters.";
    }
  
    if (name === "email") {
      if (!value.trim()) return "Valid email is required.";
      if (!/^\S+@\S+\.\S+$/.test(value)) return "Invalid email format.";
      if (value.length > 100) return "Email can't be more than 100 characters.";
    }
  
    if (name === "phone") {
      const phoneRegex = /^\+?[0-9]{7,15}$/;
      if (value.trim() && !phoneRegex.test(value)) return "Invalid phone number format.";
      if (value.length > 30) return "Phone number can't be more than 30 characters.";
    }
  
    if (name === "password") {
      if (!value.trim()) return "Password is required.";
      if (value.length < 8) return "Password must be at least 8 characters long.";
      if (value.length > 128) return "Password can't be more than 128 characters.";
      if (!/[A-Z]/.test(value) || !/[a-z]/.test(value) || !/\d/.test(value)) {
        return "Password must contain at least one uppercase letter, one lowercase letter, and one number.";
      }
    }
  
    if (name === "confirmPassword") {
      if (!value.trim()) return "Confirm password is required.";
      if (value !== formData.password) return "Passwords do not match.";
    }
  
    if (name === "dateOfBirth") {
      const today = new Date().toISOString().split("T")[0];
      if (!value.trim()) return "Date of birth is required.";
      if (value > today) return "Date of birth cannot be in the future.";
    }
  
    if (name === "country") {
      if (!value.trim()) return "Country is required.";
      if (value.length > 100) return "Country name can't be more than 100 characters.";
    }
  
    if (name === "region") {
      if (!value.trim()) return "Region is required.";
      if (value.length > 100) return "Region name can't be more than 100 characters.";
    }
  
    if (name === "postalCode") {
      if (value.trim() && value.length > 25) return "Postal code can't be more than 25 characters.";
    }
  
    return null;
  };

  //Hent IP fra API
  useEffect(() => {
    const fetchUserCountry = async () => {
      try {
        const response = await fetch("https://ipapi.co/json/");
        const data = await response.json();
        
        if (data && data.country_name && !formData.country && !hasSetCountry.current) {
          hasSetCountry.current = true; // 👈 Sørg for at vi bare setter dette én gang
          setFormData((prev) => ({ ...prev, country: data.country_name }));
        }
      } catch (error) {
        console.error("Kunne ikke hente brukerens land:", error);
      }
    };
  
    fetchUserCountry();
  }, [formData.country]);

    // Håndterer inputendringer
    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      
      setMessage("");
      const { name, value } = e.target;
      let formattedValue = value;
    
      

      if (name === "phone") {
        formattedValue = value.replace(/\s+/g, ""); // Fjern mellomrom
        if (!/^\+?[0-9]{7,15}$/.test(formattedValue) && formattedValue !== "") {
          setErrors((prev) => ({ ...prev, phone: "Telefonnummeret er ugyldig." }));
        } else {
          setErrors((prev) => {
            const newErrors = { ...prev };
            delete newErrors.phone; // ✅ Fjern feil hvis telefonnummeret er gyldig
            return newErrors;
          });
        }
      }

      if (name === "dateOfBirth") {
    validateSingleField(name, formattedValue);
  }

      setFormData((prev) => ({
        ...prev,
        [name]: name === "dateOfBirth"
          ? value // Behold kun YYYY-MM-DD format
          : value,
      }));

      // Fjern feil for feltet hvis det har blitt rettet
      setErrors((prevErrors) => {
        if (prevErrors[name]) {
          const newErrors = { ...prevErrors };
          delete newErrors[name]; // 🔥 Riktig fjerning av feil
          return newErrors;
        }
        return prevErrors;
      });
    };
    

 // Håndterer valg av land
const handleCountryChange = async (eventOrCountry: React.ChangeEvent<HTMLSelectElement> | string) => {
  const selectedCountry = typeof eventOrCountry === "string" ? eventOrCountry : eventOrCountry.target.value;
  setFormData({ ...formData, country: selectedCountry, region: "" });

  if (!selectedCountry) {
    setRegions([]);
    return;
  }

  try {
    const res = await fetch(`https://activityfinder-gnaacbg9gsgjh7b7.swedencentral-01.azurewebsites.net/api/user/regions/${selectedCountry}`);
    if (!res.ok) throw new Error("Kunne ikke hente regioner.");
    
    const data = await res.json();
    setRegions(data);

    setFormData((prev) => ({
      ...prev,
      region: data.length > 0 ? prev.region : "" // 🚀 Setter region til null hvis ingen regioner finnes
    }));

  } catch (error) {
    console.error("Feil ved henting av regioner:", error);
    setRegions([]);
    setFormData((prev) => ({
      ...prev,
      region: "" // ✅ Sikrer at vi ikke sender "null" som string
    }));
  }
};



useEffect(() => {
  console.log("Akkurat nå, errors:", errors);
}, [errors]);


  useEffect(() => {
    if (!formData.country) return;
    const fetchRegions = async () => {
      try {
        const res = await fetch(`https://activityfinder-gnaacbg9gsgjh7b7.swedencentral-01.azurewebsites.net/api/user/regions/${formData.country}`);
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

    if (!formData.region || formData.region === "null") {
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
        console.log("Sending dateOfBirth:", formData.dateOfBirth);
        setFormData({ firstName: "", middleName: "", lastName: "", email: "", password: "", confirmPassword: "", phone: "", dateOfBirth: "", country: "", region: "", postalCode: "" });
        setShowSuccessModal(true);
        setTimeout(() => {
          setShowSuccessModal(false);
          setIsRegistered(true); // 🚀 Oppdater state i stedet for å navigere direkte
        }, 1000);


      } else {
        setErrors(data.errors || { general: "Kunne ikke registrere bruker." });
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
      console.log("Navigerer til /login...");
      setTimeout(() => {
        router.replace("/login");
      }, 1000); // 🚀 Naviger kun etter at state har endret seg
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
  <label htmlFor="firstName" className="text-gray-300 font-medium text-right">First name:</label>

  <div className="flex flex-col w-full">
    <input
      id="firstName"
      type="text"
      name="firstName"
      placeholder="First name"
      value={formData.firstName}
      onChange={handleChange}
      onBlur={handleBlur}
      className={`w-full h-12 px-4 border rounded-md bg-gray-700 text-white 
        ${touchedFields.firstName && errors.firstName ? "border-red-500" : "border-gray-500"}`}
    />
    {touchedFields.firstName && errors.firstName && (
      <p className="text-red-500 text-sm mt-1">{errors.firstName}</p>
    )}
  </div>

  <div className="relative flex justify-start group">
  <Info className="text-gray-400 cursor-pointer" size={18} />

  {/* 🛠️ Tooltip som holder seg synlig */}
  <div className="absolute left-6 bottom-full mb-2 hidden group-hover:flex 
      bg-gray-800 text-white text-xs p-2 rounded-md shadow-md w-40 z-10">
    Required: Your first name. Max characters: 50.
  </div>
</div>

  {/* 🔥 MELLOMNAVN */}
  <label htmlFor="middleName" className="text-gray-300 font-medium text-right">Middle name:</label>

  <div className="flex flex-col w-full">
    <input
      id="middleName"
      type="text"
      name="middleName"
      placeholder="Middle name (not required)"
      value={formData.middleName}
      onChange={handleChange}
      onBlur={handleBlur}
      className={`w-full h-12 px-4 border rounded-md bg-gray-700 text-white 
        ${touchedFields.middleName && errors.middleName ? "border-red-500" : "border-gray-500"}`}
    />
    {touchedFields.middleName && errors.middleName && (
      <p className="text-red-500 text-sm mt-1">{errors.middleName}</p>
    )}
  </div>


<div className="relative flex justify-start group">
  <Info className="text-gray-400 cursor-pointer" size={18} />

  {/* 🛠️ Tooltip som holder seg synlig */}
  <div className="absolute left-6 bottom-full mb-2 hidden group-hover:flex 
      bg-gray-800 text-white text-xs p-2 rounded-md shadow-md w-40 z-10">
    Not required: Your middle name. Max characters: 50.
  </div>
</div>

  {/* 🔥 ETTERNAVN */}
  <label htmlFor="lastName" className="text-gray-300 font-medium text-right">Last name:</label>

  <div className="flex flex-col w-full">
    <input
      id="lastName"
      type="text"
      name="lastName"
      placeholder="Last name"
      value={formData.lastName}
      onChange={handleChange}
      onBlur={handleBlur}
      className={`w-full h-12 px-4 border rounded-md bg-gray-700 text-white 
        ${touchedFields.lastName && errors.lastName ? "border-red-500" : "border-gray-500"}`}
    />
    {touchedFields.lastName && errors.lastName && (
      <p className="text-red-500 text-sm mt-1">{errors.lastName}</p>
    )}
  </div>

  <div className="relative flex justify-start group">
  <Info className="text-gray-400 cursor-pointer" size={18} />

  {/* 🛠️ Tooltip som holder seg synlig */}
  <div className="absolute left-6 bottom-full mb-2 hidden group-hover:flex 
      bg-gray-800 text-white text-xs p-2 rounded-md shadow-md w-40 z-10">
    Required: Your last name. Max characters: 50.
  </div>
</div>

  {/* 🔥 E-POST */}
  <label htmlFor="email" className="text-gray-300 font-medium text-right">Email:</label>

  <div className="flex flex-col w-full">
    <input
      id="email"
      type="email"
      name="email"
      placeholder="Email"
      value={formData.email}
      onChange={handleChange}
      onBlur={handleBlur}
      className={`w-full h-12 px-4 border rounded-md bg-gray-700 text-white 
        ${touchedFields.email && errors.email ? "border-red-500" : "border-gray-500"}`}
    />
    {touchedFields.email && errors.email && (
      <p className="text-red-500 text-sm mt-1">{errors.email}</p>
    )}
  </div>

  <div className="relative flex justify-start group">
  <Info className="text-gray-400 cursor-pointer" size={18} />

  {/* 🛠️ Tooltip som holder seg synlig */}
  <div className="absolute left-6 bottom-full mb-2 hidden group-hover:flex 
      bg-gray-800 text-white text-xs p-2 rounded-md shadow-md w-40 z-10">
    Required: Email. Only one user per email. Max characters: 100.
  </div>
</div>

{/* 🔥 PASSORD */}
<label htmlFor="password" className="text-gray-300 font-medium text-right">Passord:</label>

<div className="relative w-full flex flex-col"> {/* Holder øyeikonet låst */}
  <div className="relative w-full">
    <input
      id="password"
      type={showPassword ? "text" : "password"}
      name="password"
      placeholder="Password"
      value={formData.password}
      onChange={handleChange}
      onBlur={handleBlur}
      className={`w-full h-12 px-4 pr-10 border rounded-md bg-gray-700 text-white
        ${touchedFields.password && errors.password ? "border-red-500" : "border-gray-500"}`}
    />

    {/* ØYE-IKONET FOR VISNING AV PASSORD */}
    <button
      type="button"
      onClick={togglePasswordVisibility}
      className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-200"
    >
      {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
    </button>
  </div>

  {/* FEILMELDING SOM SKYVER FELTET UNDER */}
  {touchedFields.password && errors.password && (
    <p className="text-red-500 text-xs mt-1">{errors.password}</p>
  )}
</div>

{/* 🔥 TOOLTIP FOR PASSORDREGLER */}
<div className="relative flex justify-start group">
  <Info className="text-gray-400 cursor-pointer" size={18} />
  <div className="absolute left-6 bottom-full mb-2 hidden group-hover:flex 
      bg-gray-800 text-white text-xs p-2 rounded-md shadow-md w-56 z-10">
    Password must contain at least one lowercase letter, uppercase letter, and a number. 
    Must be at least 8 characters long and less than 128.
  </div>
</div>

  {/* 🔥 BEKREFT PASSORD */}
<label htmlFor="confirmPassword" className="text-gray-300 font-medium text-right">Confirm password:</label>

<div className="relative w-full flex flex-col">
  <div className="relative w-full">
    <input
      id="confirmPassword"
      type={showConfirmPassword ? "text" : "password"}
      name="confirmPassword"
      placeholder="Confirm Password"
      value={formData.confirmPassword}
      onChange={handleChange}
      onBlur={handleBlur}
      className={`w-full h-12 px-4 pr-10 border rounded-md bg-gray-700 text-white
        ${touchedFields.confirmPassword && errors.confirmPassword ? "border-red-500" : "border-gray-500"}`}
    />

    {/* ØYE-IKONET FOR BEKREFT PASSORD */}
    <button
      type="button"
      onClick={toggleConfirmPasswordVisibility}
      className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-200"
    >
      {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
    </button>
  </div>

  {/* FEILMELDING SOM SKYVER FELTET UNDER */}
  {touchedFields.confirmPassword && errors.confirmPassword && (
    <p className="text-red-500 text-xs mt-1">{errors.confirmPassword}</p>
  )}
</div>



  <div className="relative flex justify-start group">
  <Info className="text-gray-400 cursor-pointer" size={18} />

  {/* 🛠️ Tooltip som holder seg synlig */}
  <div className="absolute left-6 bottom-full mb-2 hidden group-hover:flex 
      bg-gray-800 text-white text-xs p-2 rounded-md shadow-md w-40 z-10">
    Required: Password. Must match.
  </div>
</div>

  {/* 🔥 TELEFONNUMMER */}
  <label htmlFor="phone" className="text-gray-300 font-medium text-right">Telefonnummer (valgfritt):</label>

  <div className="flex flex-col w-full">
  <input
    id="phone"
    type="tel"
    name="phone"
    placeholder="Phonenumber"
    value={formData.phone}
    onChange={handleChange}
    onBlur={handleBlur}
    className={`w-full h-12 px-4 border rounded-md bg-gray-700 text-white 
      ${touchedFields.phone && errors.phone ? "border-red-500" : "border-gray-500"}`}
  />
  {touchedFields.phone && errors.phone && <p className="text-red-500 text-sm mt-1">{errors.phone}</p>}
</div>

<div className="relative flex justify-start group">
  <Info className="text-gray-400 cursor-pointer" size={18} />

  {/* 🛠️ Tooltip som holder seg synlig */}
  <div className="absolute left-6 bottom-full mb-2 hidden group-hover:flex 
      bg-gray-800 text-white text-xs p-2 rounded-md shadow-md w-40 z-10">
    Not required: Must be a valid phonenumber. Will maybe be for verification later.
  </div>
</div>

{/* 🔥 FØDSELSDATO */}
<label htmlFor="dateOfBirth" className="text-gray-300 font-medium text-right">Date of birth:</label>
  <div className="flex flex-col w-full">
    <input
      id ="dateOfBirth"
      type="date" 
      name="dateOfBirth" 
      value={formData.dateOfBirth} 
      onChange={handleChange} 
      onBlur={handleBlur}
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
  <label htmlFor="country" className="text-gray-300 font-medium text-right">Country:</label>
<div className="flex flex-col w-full">
  <select 
    id="country"
    name="country" 
    value={formData.country} 
    onChange={handleCountryChange} 
    className={`w-full h-12 px-4 border rounded-md bg-gray-700 text-white 
      ${touchedFields.country && errors.country ? "border-red-500" : "border-gray-500"}`}
  >
    <option value="">Velg land</option>
    {countries.map((country) => (
      <option key={country} value={country}>{country}</option>
    ))}
  </select>
  {touchedFields.country && errors.country && <p className="text-red-500 text-sm mt-1">{errors.country}</p>}
</div>

<div className="relative flex justify-start group">
  <Info className="text-gray-400 cursor-pointer" size={18} />

  {/* 🛠️ Tooltip som holder seg synlig */}
  <div className="absolute left-6 bottom-full mb-2 hidden group-hover:flex 
      bg-gray-800 text-white text-xs p-2 rounded-md shadow-md w-40 z-10">
    Required: Country. Required to follow the law.
  </div>
</div>

  {/* 🔥 REGION */}
  <label htmlFor="region" className="text-gray-300 font-medium text-right">Region:</label>
  <div className="flex flex-col w-full">
    <select 
      id="region"
      name="region" 
      value={formData.region || ""} 
      onChange={handleChange} 
      disabled={!formData.country} 
      className={`w-full h-12 px-4 border rounded-md bg-gray-700 text-white 
        ${touchedFields.region && errors.region ? "border-red-500" : "border-gray-500"}`}
    >
      <option value="">Choose region</option>
      {regions.map((r) => (
        <option key={r} value={r}>{r}</option>
      ))}
    </select>
    {touchedFields.region && errors.region && <p className="text-red-500 text-sm mt-1">{errors.region}</p>}
  </div>

  <div className="relative flex justify-start group">
  <Info className="text-gray-400 cursor-pointer" size={18} />

  {/* 🛠️ Tooltip som holder seg synlig */}
  <div className="absolute left-6 bottom-full mb-2 hidden group-hover:flex 
      bg-gray-800 text-white text-xs p-2 rounded-md shadow-md w-40 z-10">
    Required: Region. For updates in your region, might need more work.
  </div>
</div>

  {/* 🔥 POSTNUMMER */}
  <label htmlFor="postalCode" className="text-gray-300 font-medium text-right">PostalCode:</label>
  <div className="flex flex-col w-full">
    <input
      id="postalCode"
      type="text" 
      name="postalCode" 
      placeholder="Postal code (not required)" 
      value={formData.postalCode} 
      onChange={handleChange} 
      onBlur={handleBlur} 
      className="w-full h-12 px-4 border rounded-md bg-gray-700 text-white"
    />
    {touchedFields.postalCode && errors.postalCode && <p className="text-red-500 text-sm mt-1">{errors.postalCode}</p>}
  </div>

  <div className="relative flex justify-start group">
  <Info className="text-gray-400 cursor-pointer" size={18} />

  {/* 🛠️ Tooltip som holder seg synlig */}
  <div className="absolute left-6 bottom-full mb-2 hidden group-hover:flex 
      bg-gray-800 text-white text-xs p-2 rounded-md shadow-md w-40 z-10">
    Not required: PostalCode. For activites/updates in your local area, get warnings/important news/activities. Might use GPS-location later.
  </div>
</div>

  {/* 🔥 SIGN UP BUTTON */}
  <div className="col-span-3 flex justify-center mt-4">
    <button
      type="button"
      className="w-full max-w-sm h-12 bg-[#166016] text-white rounded-lg font-semibold hover:bg-[#0F3D0F] transition"
      onClick={handleAttemptSubmit}
      disabled={isSubmitting} //Har man trykket uten errors så blir knappen låst
    >
      {isSubmitting ? "Submitting..." : "Sign up"}
    </button>
    {message && (
    <p className="mt-2 text-sm text-green-500">{message}</p>
      )}
      
  </div>
      
  </form>
  {showSuccessModal && <SuccessModal onClose={() => setShowSuccessModal(false)} />}
    </div>
  );
  
}