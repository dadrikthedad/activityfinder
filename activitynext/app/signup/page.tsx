"use client";// Use client bestemmer at vi skal kjøre i nettleseren(client) og ikke kun på serveren. Må være øverst før alle imports

// useSate gjør at vi kan lagre en "state", og det er verdier som kan endres. useEffect brukes til API-kall og events. Kjøres kun når vi mounter den og en når en effekt blir endret
// useRef lagrer referanser eller verdier uten rerender, bra for å telle noe eller timeout/invervals som ikkek skal miste veriden ved rerender.
// render betyr at react bygger og viser komponentene på skjermen. Det skjer når siden lastest og hvis vi endrer noe, feks trykker på en tast. 
import { useState, useEffect } from "react";
// 
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
import FormButton from "@/components/FormButton";
import {
  checkEmailAvailability,
} from "@/services/user";
import { useCountryAndRegion } from "@/hooks/useCountryAndRegion";
import { useRegisterUser } from "@/hooks/useRegisterUser";



export default function Signup() {
  const {
    formData,
    errors,
    setErrors,
    touchedFields,
    setTouchedFields,
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
    gender: "",
  });

  // countries er veriden som kan endres, setCountries brukes for å oppdatere verdien når den blir kalt
    const [isRegistered, setIsRegistered] = useState(false);
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const router = useRouter();
    const { countries, regions, handleCountryChange, countryCodes  } = useCountryAndRegion({
      country: formData.country,
      setFormData,
    });
    
    const { registerUser, isSubmitting } = useRegisterUser({
      formData,
      countryCodes,
      setFormData,
      setErrors,
      setMessage,
      onSuccess: () => {
        setShowSuccessModal(true);
        setTimeout(() => {
          setShowSuccessModal(false);
          setIsRegistered(true);
        }, 1000);
      },
    });

  


  // Håndterer og gir en error hvis ikke alt er fylt og vi klikker på submit
  const handleAttemptSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const allTouched = Object.keys(formData).reduce((acc, key) => {
      acc[key as FieldName] = true;
      return acc;
    }, {} as typeof touchedFields);
    setTouchedFields(allTouched);

    const { errors: newErrors } = validateAllFields();
    const emailAvailable = await checkEmailAvailability(formData.email);

    if (!emailAvailable) {
      newErrors.email = "An account with this email already exists.";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      setMessage("Please fix all required fields.");
      return;
    }

    setErrors({});
    setMessage("");
    await registerUser();
  };
  

useEffect(() => {
  console.log("Akkurat nå, errors:", errors);
}, [errors]);

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
        value={formData.middleName  ?? ""}
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
        value={formData.phone  ?? ""}
        onChange={(e) => handleChange("phone", e.target.value)}
        onBlur={() => handleBlur("phone")}
        error={errors.phone}
        touched={touchedFields.phone}
        placeholder="Phonenumber"
        tooltip="Not required: Must be a valid phonenumber. Might be used for verification later."
        />

      {/* 🔥 FØDSELSDATO */}
      <FormField
        id="dateOfBirth"
        label="Date of birth:"
        type="date"
        value={formData.dateOfBirth}
        onChange={(e) => handleChange("dateOfBirth", e.target.value)}
        onBlur={() => handleBlur("dateOfBirth")}
        error={errors.dateOfBirth}
        touched={touchedFields.dateOfBirth}
        tooltip="Required: Date of birth. Required for age verification."
      />


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
        value={formData.region ?? ""}
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
          value={formData.postalCode ?? ""}
          onChange={(e) => handleChange("postalCode", e.target.value)}
          onBlur={() => handleBlur("postalCode")}
          error={errors.postalCode}
          touched={touchedFields.postalCode}
          placeholder="Postal code (not required)"
          tooltip="Not required: For updates/activities in your local area. Might use GPS later."
          />
        {/* 🔥 Gender */}
        <FormField
          id="gender"
          label="Gender"
          as="select"
          value={formData.gender}
          onChange={(e) => handleChange("gender", e.target.value)}
          onBlur={() => handleBlur("gender")}
          error={errors.gender}
          touched={touchedFields.gender}
          options={[
            { label: "Select Gender", value: "" }, // <- default
            { label: "Male", value: "Male" },
            { label: "Female", value: "Female" },
            { label: "Unspecified", value: "Unspecified" },
            ]}
          tooltip="Required: For personalization and optional filtering."
          />


          {/* 🔥 SIGN UP BUTTON */}
          <div className="col-span-3 flex flex-col items-center mt-4 space-y-2">
          {(message || errors["general"]) && (
          <div className="text-sm text-center">
            {message && <p className="text-red-500">{message}</p>}
            {errors["general"] && <p className="text-red-500">{errors["general"]}</p>}
          </div>
        )}
        
        <FormButton
          text="Sign up"
          submittingText="Submitting..."
          isSubmitting={isSubmitting}
          type="submit"
          onClick={handleAttemptSubmit}
        />
      </div>
      
  </form>
  {showSuccessModal && <SuccessModal onClose={() => setShowSuccessModal(false)} />}
    </div>
  );
  
}