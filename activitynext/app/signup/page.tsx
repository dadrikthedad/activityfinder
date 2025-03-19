"use client";
import { useState, useEffect, useRef } from "react";
import { Info, Eye, EyeOff } from "lucide-react";
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
    region: "" as string | null,
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
    const [passwordMatchError, setPasswordMatchError] = useState("");
    const [hasSubmitted, setHasSubmitted] = useState(false);
    const emailCheckTimeout = useRef<NodeJS.Timeout | null>(null);
    const [isRegistered, setIsRegistered] = useState(false);
    const [touchedFields, setTouchedFields] = useState<{ [key: string]: boolean }>({});

  
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

    if (name === "email") {
      checkEmailAvailability(value); // 🔥 Sjekker e-post i backend
    }

    setTouchedFields((prev) => ({ ...prev, [name]: true })); // 👈 Registrerer at feltet er besøkt
    validateSingleField(name, value); // 🔥 Kjør validering kun når feltet er besøkt
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
    let newErrors = { ...errors };
  
    if (name === "firstName") {
      if (!value.trim()) newErrors.firstName = "First name is required.";
      else if (value.length > 50) newErrors.firstName = "First name can't be more than 50 characters.";
      else delete newErrors.firstName;
    }
  
    if (name === "middleName") {
      if (value.trim() && value.length > 50) newErrors.middleName = "Middle name can't be more than 50 characters.";
      else delete newErrors.middleName;
    }
  
    if (name === "lastName") {
      if (!value.trim()) newErrors.lastName = "Last name is required.";
      else if (value.length > 50) newErrors.lastName = "Last name can't be more than 50 characters.";
      else delete newErrors.lastName;
    }
  
    if (name === "email") {
      if (!value.trim()) newErrors.email = "Valid email is required.";
      else if (!/^\S+@\S+\.\S+$/.test(value)) newErrors.email = "Invalid email format.";
      else if (value.length > 100) newErrors.email = "Email can't be more than 100 characters.";
      else delete newErrors.email;
    }
  
    if (name === "phone") {
      const phoneRegex = /^\+?[0-9]{7,15}$/;
      if (value.trim() && !phoneRegex.test(value)) newErrors.phone = "Invalid phone number format.";
      else if (value.length > 30) newErrors.phone = "Phone number can't be more than 30 characters.";
      else delete newErrors.phone;
    }
  
    if (name === "password") {
      if (!value.trim()) newErrors.password = "Password is required.";
      else if (value.length < 8) newErrors.password = "Password must be at least 8 characters long.";
      else if (value.length > 128) newErrors.password = "Password can't be more than 128 characters.";
      else if (!/[A-Z]/.test(value) || !/[a-z]/.test(value) || !/\d/.test(value)) {
        newErrors.password = "Password must contain at least one uppercase letter, one lowercase letter, and one number.";
      } else delete newErrors.password;
    }
  
    if (name === "confirmPassword") {
      if (!value.trim()) newErrors.confirmPassword = "Confirm password is required.";
      else if (value !== formData.password) newErrors.confirmPassword = "Passwords do not match.";
      else delete newErrors.confirmPassword;
    }
  
    if (name === "dateOfBirth") {
      if (!value.trim()) newErrors.dateOfBirth = "Date of birth is required.";
      else delete newErrors.dateOfBirth;
    }
  
    if (name === "country") {
      if (!value.trim()) newErrors.country = "Country is required.";
      else if (value.length > 100) newErrors.country = "Country name can't be more than 100 characters.";
      else delete newErrors.country;
    }
  
    if (name === "region") {
      if (!value.trim()) newErrors.region = "Region is required.";
      else if (value.length > 100) newErrors.region = "Region name can't be more than 100 characters.";
      else delete newErrors.region;
    }
  
    if (name === "postalCode") {
      if (value.trim() && value.length > 25) newErrors.postalCode = "Postal code can't be more than 25 characters.";
      else delete newErrors.postalCode;
    }
  
    setErrors(newErrors);
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
  setFormData({ ...formData, country: selectedCountry, region: ""}); 

  if (!selectedCountry) {
    setRegions([]);
    return; // ❌ Unngå unødvendige API-kall
  }

  try {
    const res = await fetch(`https://activityfinder-gnaacbg9gsgjh7b7.swedencentral-01.azurewebsites.net/api/user/regions/${selectedCountry}`);
    if (!res.ok) throw new Error("Kunne ikke hente regioner.");
    
    const data = await res.json();
    setRegions(data);

    if (data.length === 0) {
      setFormData((prev) => ({ ...prev, region: "" }));
    }

  } catch (error) {
    console.error("Feil ved henting av regioner:", error);
    setRegions([]);
    setFormData((prev) => ({ ...prev, region: "" }));
  }
};



const validateForm = () => {
  let newErrors: { [key: string]: string } = {};

  if (!formData.firstName.trim()) newErrors.firstName = "Fornavn er påkrevd.";
  if (!formData.lastName.trim()) newErrors.lastName = "Etternavn er påkrevd.";
  if (!formData.email.trim() || !/^\S+@\S+\.\S+$/.test(formData.email)) newErrors.email = "Ugyldig e-postformat.";

  if (formData.middleName.trim() && formData.middleName.length > 50) {
    newErrors.middleName = "Middle name can't be more than 50 characters.";
  }
  
  
  if (!formData.password.trim()) newErrors.password = "Passord er påkrevd.";
  else if (formData.password.length < 8) newErrors.password = "Passordet må være minst 8 tegn.";
  else if (!/[A-Z]/.test(formData.password) || !/[a-z]/.test(formData.password) || !/\d/.test(formData.password)) {
    newErrors.password = "Passordet må inneholde minst én stor bokstav, én liten bokstav og ett tall.";
  }

  if (!formData.confirmPassword.trim()) newErrors.confirmPassword = "Bekreft passord er påkrevd.";
  else if (formData.password !== formData.confirmPassword) newErrors.confirmPassword = "Passordene stemmer ikke overens.";

  if (!formData.dateOfBirth) newErrors.dateOfBirth = "Fødselsdato er påkrevd.";
  if (!formData.country) newErrors.country = "Land er påkrevd.";
  if (!formData.region && regions.length > 0) {
    newErrors.region = "Region is required.";
  }

  setErrors(newErrors);
  return Object.keys(newErrors).length === 0; // ✅ Returnerer true hvis skjemaet er gyldig
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

    fetchRegions();
  }, [formData.country]);



  

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
  <label className="text-gray-300 font-medium text-right">First name:</label>

  <div className="flex flex-col w-full">
    <input
      type="text"
      name="firstName"
      placeholder="Fornavn"
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
  <label className="text-gray-300 font-medium text-right">Middle name: (valgfritt):</label>

  <div className="flex flex-col w-full">
    <input
      type="text"
      name="middleName"
      placeholder="Mellomnavn"
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
  <label className="text-gray-300 font-medium text-right">Last name:</label>

  <div className="flex flex-col w-full">
    <input
      type="text"
      name="lastName"
      placeholder="Etternavn"
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
  <label className="text-gray-300 font-medium text-right">Email:</label>

  <div className="flex flex-col w-full">
    <input
      type="email"
      name="email"
      placeholder="E-post"
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
<label className="text-gray-300 font-medium text-right">Passord:</label>

<div className="relative w-full flex flex-col"> {/* Holder øyeikonet låst */}
  <div className="relative w-full">
    <input
      type={showPassword ? "text" : "password"}
      name="password"
      placeholder="Passord"
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
<label className="text-gray-300 font-medium text-right">Confirm password:</label>

<div className="relative w-full flex flex-col">
  <div className="relative w-full">
    <input
      type={showConfirmPassword ? "text" : "password"}
      name="confirmPassword"
      placeholder="Bekreft passord"
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
  <label className="text-gray-300 font-medium text-right">Telefonnummer (valgfritt):</label>

  <div className="flex flex-col w-full">
  <input
    type="tel"
    name="phone"
    placeholder="Telefonnummer"
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
<label className="text-gray-300 font-medium text-right">Date of birth:</label>
  <div className="flex flex-col w-full">
    <input 
      type="date" 
      name="dateOfBirth" 
      value={formData.dateOfBirth} 
      onChange={handleChange} 
      onBlur={handleBlur} 
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
  <label className="text-gray-300 font-medium text-right">Country:</label>
<div className="flex flex-col w-full">
  <select 
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
  <label className="text-gray-300 font-medium text-right">Region:</label>
  <div className="flex flex-col w-full">
    <select 
      name="region" 
      value={formData.region || ""} 
      onChange={handleChange} 
      disabled={!formData.country} 
      className={`w-full h-12 px-4 border rounded-md bg-gray-700 text-white 
        ${touchedFields.region && errors.region ? "border-red-500" : "border-gray-500"}`}
    >
      <option value="">Velg region</option>
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
  <label className="text-gray-300 font-medium text-right">PostalCode:</label>
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
      type="submit"
      className="w-full max-w-sm h-12 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed"
      disabled={
        Object.keys(errors).length > 0 ||
        !formData.firstName ||
        !formData.lastName ||
        !formData.email ||
        !formData.password ||
        !formData.confirmPassword ||
        !formData.dateOfBirth ||  // 👈 Må fylles ut
        !formData.country ||      // 👈 Må fylles ut
        !formData.region   
      }
    >
      Sign up
    </button>
  </div>

</form>
    </div>
  );
  
}