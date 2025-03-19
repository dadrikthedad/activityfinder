"use client";
import { useState, useEffect, useRef } from "react";
import { Info } from "lucide-react";
import { useRouter } from "next/navigation";

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
    const [loadingCountries, setLoadingCountries] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [showDropdown, setShowDropdown] = useState(false);
    const [activeIndex, setActiveIndex] = useState(-1);
    const hasSetCountry = useRef(false); // 👈 Lagrer om vi allerede har satt landet
    const dropdownRef = useRef<HTMLUListElement>(null)
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [passwordMatchError, setPasswordMatchError] = useState("");
    const [hasSubmitted, setHasSubmitted] = useState(false);
    const emailCheckTimeout = useRef<NodeJS.Timeout | null>(null);
    const [isRegistered, setIsRegistered] = useState(false);

    const filteredCountries = countries.filter(country =>
      country.toLowerCase().includes(searchQuery.toLowerCase()) // 🔥 Filtrer basert på søk
    );
  
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
      } finally {
        setLoadingCountries(false);
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
    if (formData.confirmPassword && formData.password !== formData.confirmPassword) {
      setPasswordMatchError("The passwords must match.");
    } else {
      setPasswordMatchError("");
    }
  }, [formData.password, formData.confirmPassword]);

  useEffect(() => {
    if (!formData.email.trim() || !/^\S+@\S+\.\S+$/.test(formData.email)) return;

    if (emailCheckTimeout.current) clearTimeout(emailCheckTimeout.current);

    emailCheckTimeout.current = setTimeout(() => {
      checkEmailAvailability(formData.email);
    }, 500); // Vent 500ms før vi sjekker
  }, [formData.email]);

  const handleBlur = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    validateSingleField(name, value);
    if (name === "email") {
      checkEmailAvailability(value); // 🔥 Sjekker e-post i backend
    }
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
  const validateSingleField = (name: string, value: string) => {
    let error = "";
  
    if (name === "firstName" && !value.trim()) error = "Fornavn er påkrevd.";
    if (name === "lastName" && !value.trim()) error = "Etternavn er påkrevd.";
    if (name === "email" && (!value.trim() || !/^\S+@\S+\.\S+$/.test(value))) error = "Ugyldig e-postformat.";
  
    if (name === "password") {
      if (!value.trim()) error = "Passord er påkrevd.";
      else if (value.length < 8) error = "Passordet må være minst 8 tegn.";
      else if (!/[A-Z]/.test(value) || !/[a-z]/.test(value) || !/\d/.test(value)) {
        error = "Passordet må inneholde minst én stor bokstav, én liten bokstav og ett tall.";
      }
    }
  
    if (name === "confirmPassword" && value !== formData.password) {
      error = "Passordene stemmer ikke overens.";
    }
  
    setErrors((prevErrors) => {
      const newErrors = { ...prevErrors };
      
      if (error) {
        // 🔴 Legger til feilmelding
        newErrors[name] = error;
      } else {
        // ✅ Fjerner feilmelding hvis feltet er gyldig
        delete newErrors[name];
      }
  
      return newErrors;
    });
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
  }, []);

    // Håndterer inputendringer
    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
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
  setFormData({ ...formData, country: selectedCountry });
  setSearchQuery(selectedCountry); // 👈 Oppdater søkefeltet

  if (!selectedCountry) {
    setRegions([]);
    return; // ❌ Unngå unødvendige API-kall
  }

  try {
    const res = await fetch(`https://activityfinder-gnaacbg9gsgjh7b7.swedencentral-01.azurewebsites.net/api/user/regions/${selectedCountry}`);
    if (!res.ok) throw new Error("Kunne ikke hente regioner.");
    
    const data = await res.json();
    setRegions(data);
  } catch (error) {
    console.error("Feil ved henting av regioner:", error);
    setRegions([]);
  }
};


const selectCountry = (country: string) => {
  setFormData({ ...formData, country: country }); // 👈 Sørg for at landet oppdateres riktig
  setSearchQuery(country);
  setShowDropdown(false);
  setActiveIndex(-1); // ✅ Nullstill aktivt valg // ✅ Skjul dropdown etter valg
};

const validateForm = () => {
  let newErrors: { [key: string]: string } = {};

  if (!formData.firstName.trim()) newErrors.firstName = "Fornavn er påkrevd.";
  if (!formData.lastName.trim()) newErrors.lastName = "Etternavn er påkrevd.";
  if (!formData.email.trim() || !/^\S+@\S+\.\S+$/.test(formData.email)) newErrors.email = "Ugyldig e-postformat.";
  
  if (!formData.password.trim()) newErrors.password = "Passord er påkrevd.";
  else if (formData.password.length < 8) newErrors.password = "Passordet må være minst 8 tegn.";
  else if (!/[A-Z]/.test(formData.password) || !/[a-z]/.test(formData.password) || !/\d/.test(formData.password)) {
    newErrors.password = "Passordet må inneholde minst én stor bokstav, én liten bokstav og ett tall.";
  }

  if (!formData.confirmPassword.trim()) newErrors.confirmPassword = "Bekreft passord er påkrevd.";
  else if (formData.password !== formData.confirmPassword) newErrors.confirmPassword = "Passordene stemmer ikke overens.";

  if (!formData.dateOfBirth) newErrors.dateOfBirth = "Fødselsdato er påkrevd.";
  if (!formData.country) newErrors.country = "Land er påkrevd.";
  if (!formData.region) newErrors.region = "Region er påkrevd.";

  setErrors(newErrors);
  return Object.keys(newErrors).length === 0; // ✅ Returnerer true hvis skjemaet er gyldig
};

const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
  if (e.key === "ArrowDown") {
    e.preventDefault();
    setActiveIndex((prev) => (prev < filteredCountries.length - 1 ? prev + 1 : 0));
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    setActiveIndex((prev) => (prev > 0 ? prev - 1 : prev));
  } else if (e.key === "Enter" && activeIndex >= 0) {
    e.preventDefault();
    selectCountry(filteredCountries[activeIndex]); // ✅ Velg aktivt land
    setShowDropdown(false); // ✅ Lukk dropdown
  } else if (e.key === "Escape") {
    setShowDropdown(false); // ✅ Lukker dropdown hvis Esc trykkes
  }
};

useEffect(() => {
  console.log("Akkurat nå, errors:", errors);
}, [errors]);

useEffect(() => {
  if (dropdownRef.current && activeIndex >= 0) {
    dropdownRef.current.children[activeIndex]?.scrollIntoView({ block: "nearest" });
  }
}, [activeIndex]);

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

    fetchRegions();
  }, [formData.country]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!event.target || !(event.target as HTMLElement).closest(".country-dropdown")) {
        setShowDropdown(false);
      }
    };
  
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  

  const registerUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(""); 
    setHasSubmitted(true); // Nå vises feilmeldinger kun etter innsending
    
    const payload: Partial<typeof formData> = { ...formData };

    if (!payload.phone || payload.phone.trim() === "") {
    delete payload.phone; // 🚀 Fjern phone-feltet hvis det er tomt
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
  
      let data = await response.json();
      if (response.ok) {
        console.log("Sending dateOfBirth:", formData.dateOfBirth);
        setMessage("✅ Bruker registrert!");
        setFormData({ firstName: "", middleName: "", lastName: "", email: "", password: "", confirmPassword: "", phone: "", dateOfBirth: "", country: "", region: "", postalCode: "" });
        setTimeout(() => {
          setMessage(""); 
          setIsRegistered(true); // 🚀 Oppdater state i stedet for å navigere direkte
        }, 1000);


      } else {
        setErrors(data.errors || { general: "Kunne ikke registrere bruker." });
      }
    } catch (error) {
      console.error("Feil under registrering:", error);
      setMessage("❌ Nettverksfeil. Prøv igjen senere.");
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
      <h1 className="text-4xl font-bold text-blue-600">Register</h1>
      <p className="mt-4 text-lg text-gray-700 dark:text-gray-300">
        Create a new user.
      </p>
  
      <form onSubmit={registerUser} className="mt-6 grid grid-cols-3 gap-x-6 gap-y-4 items-center w-full max-w-2xl">
  
  {/* 🔥 FORNAVN */}
  <label className="text-gray-300 font-medium text-right">Fornavn:</label>

  <div className="flex flex-col w-full">
    <input
      type="text"
      name="firstName"
      placeholder="Fornavn"
      value={formData.firstName}
      onChange={handleChange}
      onBlur={handleBlur}
      className={`w-full h-12 px-4 border rounded-md bg-gray-700 text-white 
        ${errors.firstName ? "border-red-500" : "border-gray-500"}`}
    />
    {errors.firstName && (
      <p className="text-red-500 text-sm mt-1">{errors.firstName}</p>
    )}
  </div>

  <div className="relative flex justify-start group">
  <Info className="text-gray-400 cursor-pointer" size={18} />

  {/* 🛠️ Tooltip som holder seg synlig */}
  <div className="absolute left-6 bottom-full mb-2 hidden group-hover:flex 
      bg-gray-800 text-white text-xs p-2 rounded-md shadow-md w-40 z-10">
    Ditt offisielle fornavn.
  </div>
</div>

  {/* 🔥 MELLOMNAVN */}
  <label className="text-gray-300 font-medium text-right">Mellomnavn (valgfritt):</label>

  <input
    type="text"
    name="middleName"
    placeholder="Mellomnavn"
    value={formData.middleName}
    onChange={handleChange}
    className="w-full h-12 px-4 border rounded-md bg-gray-700 text-white"
  />

<div className="relative flex justify-start group">
  <Info className="text-gray-400 cursor-pointer" size={18} />

  {/* 🛠️ Tooltip som holder seg synlig */}
  <div className="absolute left-6 bottom-full mb-2 hidden group-hover:flex 
      bg-gray-800 text-white text-xs p-2 rounded-md shadow-md w-40 z-10">
    Ditt offisielle fornavn.
  </div>
</div>

  {/* 🔥 ETTERNAVN */}
  <label className="text-gray-300 font-medium text-right">Etternavn:</label>

  <div className="flex flex-col w-full">
    <input
      type="text"
      name="lastName"
      placeholder="Etternavn"
      value={formData.lastName}
      onChange={handleChange}
      onBlur={handleBlur}
      className={`w-full h-12 px-4 border rounded-md bg-gray-700 text-white 
        ${errors.lastName ? "border-red-500" : "border-gray-500"}`}
    />
    {errors.lastName && (
      <p className="text-red-500 text-sm mt-1">{errors.lastName}</p>
    )}
  </div>

  <div className="relative flex justify-start group">
  <Info className="text-gray-400 cursor-pointer" size={18} />

  {/* 🛠️ Tooltip som holder seg synlig */}
  <div className="absolute left-6 bottom-full mb-2 hidden group-hover:flex 
      bg-gray-800 text-white text-xs p-2 rounded-md shadow-md w-40 z-10">
    Ditt offisielle fornavn.
  </div>
</div>

  {/* 🔥 E-POST */}
  <label className="text-gray-300 font-medium text-right">E-post:</label>

  <div className="flex flex-col w-full">
    <input
      type="email"
      name="email"
      placeholder="E-post"
      value={formData.email}
      onChange={handleChange}
      onBlur={handleBlur}
      className={`w-full h-12 px-4 border rounded-md bg-gray-700 text-white 
        ${errors.email ? "border-red-500" : "border-gray-500"}`}
    />
    {errors.email && (
      <p className="text-red-500 text-sm mt-1">{errors.email}</p>
    )}
  </div>

  <div className="relative flex justify-start group">
  <Info className="text-gray-400 cursor-pointer" size={18} />

  {/* 🛠️ Tooltip som holder seg synlig */}
  <div className="absolute left-6 bottom-full mb-2 hidden group-hover:flex 
      bg-gray-800 text-white text-xs p-2 rounded-md shadow-md w-40 z-10">
    Ditt offisielle fornavn.
  </div>
</div>

  {/* 🔥 PASSORD */}
  <label className="text-gray-300 font-medium text-right">Passord:</label>

  <div className="relative w-full">
    <input
      type={showPassword ? "text" : "password"}
      name="password"
      placeholder="Passord"
      value={formData.password}
      onChange={handleChange}
      onBlur={handleBlur}
      className={`w-full h-12 px-4 border rounded-md bg-gray-700 text-white 
        ${errors.password ? "border-red-500" : "border-gray-500"}`}
    />
    <button
      type="button"
      onClick={togglePasswordVisibility}
      className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-600"
    >
      {showPassword ? "👁️" : "🙈"}
    </button>
    {errors.password && (
      <p className="text-red-500 text-sm mt-1">{errors.password}</p>
    )}
  </div>

  <div className="relative flex justify-start group">
  <Info className="text-gray-400 cursor-pointer" size={18} />

  {/* 🛠️ Tooltip som holder seg synlig */}
  <div className="absolute left-6 bottom-full mb-2 hidden group-hover:flex 
      bg-gray-800 text-white text-xs p-2 rounded-md shadow-md w-40 z-10">
    Ditt offisielle fornavn.
  </div>
</div>

  {/* 🔥 BEKREFT PASSORD */}
  <label className="text-gray-300 font-medium text-right">Bekreft passord:</label>

  <div className="relative w-full">
    <input
      type={showConfirmPassword ? "text" : "password"}
      name="confirmPassword"
      placeholder="Bekreft passord"
      value={formData.confirmPassword}
      onChange={handleChange}
      onBlur={handleBlur}
      className={`w-full h-12 px-4 border rounded-md bg-gray-700 text-white 
        ${errors.confirmPassword ? "border-red-500" : "border-gray-500"}`}
    />
    <button
      type="button"
      onClick={toggleConfirmPasswordVisibility}
      className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-600"
    >
      {showConfirmPassword ? "👁️" : "🙈"}
    </button>
    {errors.confirmPassword && (
      <p className="text-red-500 text-sm mt-1">{errors.confirmPassword}</p>
    )}
  </div>

  <div className="relative flex justify-start group">
  <Info className="text-gray-400 cursor-pointer" size={18} />

  {/* 🛠️ Tooltip som holder seg synlig */}
  <div className="absolute left-6 bottom-full mb-2 hidden group-hover:flex 
      bg-gray-800 text-white text-xs p-2 rounded-md shadow-md w-40 z-10">
    Ditt offisielle fornavn.
  </div>
</div>

  {/* 🔥 TELEFONNUMMER */}
  <label className="text-gray-300 font-medium text-right">Telefonnummer (valgfritt):</label>

  <input
    type="tel"
    name="phone"
    placeholder="Telefonnummer"
    value={formData.phone}
    onChange={handleChange}
    className="w-full h-12 px-4 border rounded-md bg-gray-700 text-white"
  />

<div className="relative flex justify-start group">
  <Info className="text-gray-400 cursor-pointer" size={18} />

  {/* 🛠️ Tooltip som holder seg synlig */}
  <div className="absolute left-6 bottom-full mb-2 hidden group-hover:flex 
      bg-gray-800 text-white text-xs p-2 rounded-md shadow-md w-40 z-10">
    Ditt offisielle fornavn.
  </div>
</div>

{/* 🔥 FØDSELSDATO */}
<label className="text-gray-300 font-medium text-right">Fødselsdato:</label>
  <div className="flex flex-col w-full">
    <input 
      type="date" 
      name="dateOfBirth" 
      value={formData.dateOfBirth} 
      onChange={handleChange} 
      onBlur={handleBlur} 
      className="w-full h-12 px-4 border rounded-md bg-gray-700 text-white"
    />
    {errors.dateOfBirth && <p className="text-red-500 text-sm mt-1">{errors.dateOfBirth}</p>}
  </div>

  <div className="relative flex justify-start group">
  <Info className="text-gray-400 cursor-pointer" size={18} />

  {/* 🛠️ Tooltip som holder seg synlig */}
  <div className="absolute left-6 bottom-full mb-2 hidden group-hover:flex 
      bg-gray-800 text-white text-xs p-2 rounded-md shadow-md w-40 z-10">
    Ditt offisielle fornavn.
  </div>
</div>

  {/* 🔥 LAND */}
  <label className="text-gray-300 font-medium text-right">Land:</label>
  <div className="relative w-full">
    <input
      type="text"
      name="country"
      placeholder="Velg land..."
      value={searchQuery}
      onChange={(e) => {
        setSearchQuery(e.target.value);
        setShowDropdown(filteredCountries.length > 0);
        setActiveIndex(-1);
      }}
      onFocus={() => setShowDropdown(true)}
      onKeyDown={handleKeyDown}
      className="w-full h-12 px-4 border rounded-md bg-gray-700 text-white"
    />
    {errors.country && <p className="text-red-500 text-sm">{errors.country}</p>}
    {showDropdown && (
      <ul 
        ref={dropdownRef} 
        className="absolute z-10 bg-white border rounded-md w-full mt-1 max-h-40 overflow-y-auto shadow-lg country-dropdown"
      >
        {filteredCountries.map((country, index) => (
          <li 
            key={country}
            onClick={() => selectCountry(country)}
            className={`px-4 py-2 cursor-pointer ${activeIndex === index ? "bg-blue-500 text-white" : "hover:bg-gray-100"}`}
          >
            {country}
          </li>
        ))}
      </ul>
    )}
  </div>

  <div className="relative flex justify-start group">
  <Info className="text-gray-400 cursor-pointer" size={18} />

  {/* 🛠️ Tooltip som holder seg synlig */}
  <div className="absolute left-6 bottom-full mb-2 hidden group-hover:flex 
      bg-gray-800 text-white text-xs p-2 rounded-md shadow-md w-40 z-10">
    Ditt offisielle fornavn.
  </div>
</div>

  {/* 🔥 REGION */}
  <label className="text-gray-300 font-medium text-right">Region:</label>
  <div className="flex flex-col w-full">
    <select 
      name="region" 
      value={formData.region} 
      onChange={handleChange} 
      disabled={!formData.country} 
      className="w-full h-12 px-4 border rounded-md bg-gray-700 text-white"
    >
      <option value="">Velg region</option>
      {regions.map((r) => (
        <option key={r} value={r}>{r}</option>
      ))}
    </select>
    {errors.region && <p className="text-red-500 text-sm mt-1">{errors.region}</p>}
  </div>

  <div className="relative flex justify-start group">
  <Info className="text-gray-400 cursor-pointer" size={18} />

  {/* 🛠️ Tooltip som holder seg synlig */}
  <div className="absolute left-6 bottom-full mb-2 hidden group-hover:flex 
      bg-gray-800 text-white text-xs p-2 rounded-md shadow-md w-40 z-10">
    Ditt offisielle fornavn.
  </div>
</div>

  {/* 🔥 POSTNUMMER */}
  <label className="text-gray-300 font-medium text-right">Postnummer:</label>
  <div className="flex flex-col w-full">
    <input 
      type="text" 
      name="postalCode" 
      placeholder="Postnummer (valgfritt)" 
      value={formData.postalCode} 
      onChange={handleChange} 
      onBlur={handleBlur} 
      className="w-full h-12 px-4 border rounded-md bg-gray-700 text-white"
    />
    {errors.postalCode && <p className="text-red-500 text-sm mt-1">{errors.postalCode}</p>}
  </div>

  <div className="relative flex justify-start group">
  <Info className="text-gray-400 cursor-pointer" size={18} />

  {/* 🛠️ Tooltip som holder seg synlig */}
  <div className="absolute left-6 bottom-full mb-2 hidden group-hover:flex 
      bg-gray-800 text-white text-xs p-2 rounded-md shadow-md w-40 z-10">
    Ditt offisielle fornavn.
  </div>
</div>

  {/* 🔥 SIGN UP BUTTON */}
  <div className="col-span-3 flex justify-center mt-4">
    <button
      type="submit"
      className="w-full max-w-sm h-12 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed"
      disabled={
        Object.keys(errors).length > 0 ||
        !formData.firstName ||
        !formData.lastName ||
        !formData.email ||
        !formData.password ||
        !formData.confirmPassword
      }
    >
      Sign up
    </button>
  </div>

</form>
    </div>
  );
  
}