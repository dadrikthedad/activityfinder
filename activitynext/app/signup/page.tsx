"use client";// Use client bestemmer at vi skal kjøre i nettleseren(client) og ikke kun på serveren. Må være øverst før alle imports

// useSate gjør at vi kan lagre en "state", og det er verdier som kan endres. useEffect brukes til API-kall og events. Kjøres kun når vi mounter den og en når en effekt blir endret
// useRef lagrer referanser eller verdier uten rerender, bra for å telle noe eller timeout/invervals som ikkek skal miste veriden ved rerender.
// render betyr at react bygger og viser komponentene på skjermen. Det skjer når siden lastest og hvis vi endrer noe, feks trykker på en tast. 
import { useState, useEffect } from "react";
// 
// Henter router slik at vi kan navigere til andre sider
import { useRouter } from "next/navigation";
// Popup vinduet vårt som sier at vi har hat suksess med innlogging
import SuccessModal from "@/components/signup/SuccessModal";

// Komponenter og hooks
import { useFormHandlers } from "@/hooks/useFormHandlers";
import {
  checkEmailAvailability,
} from "@/utils/api/email";
import { useCountryAndRegion } from "@/hooks/useCountryAndRegion";
import { useRegisterUser } from "@/hooks/useRegisterUser";

// Import felt
import NameFields from "@/components/signup/NameFields";
import ContactFields from "@/components/signup/ContactFields";
import PasswordFields from "@/components/signup/PasswordFields";
import LocationFields from "@/components/signup/LocationFields";
import DemoFields from "@/components/signup/DemoFields";
import FormButton from "@/components/FormButton";
import { handleSubmit } from "@/utils/form/submitHandler";

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
  // Henter land, regioner og landkoder
  // countries er veriden som kan endres, setCountries brukes for å oppdatere verdien når den blir kalt
    const [isRegistered, setIsRegistered] = useState(false);
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const router = useRouter();
    const {
      countries,
      regions,
      countryCodes,
      fetchRegionsForCountry,
    } = useCountryAndRegion({
      country: formData.country,
      setFormData,
      editing: true,
    });
    // Hook for å registrere bruker
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

  


  // Håndterer og gir en error hvis ikke alt er fylt og vi klikker på submit. Sjekker om epost er i bruk
  const handleAttemptSubmit = (e: React.FormEvent) => {
    handleSubmit({
      e,
      formData,
      setTouchedFields,
      validateAllFields,
      setErrors,
      setMessage,
      onSubmit: registerUser,
      extraValidation: async () => {
        const errors: Record<string, string> = {};
        if (!formData.email) return errors; // skip API call
  
        const normalizedEmail = formData.email.trim().toLowerCase();
        const emailAvailable = await checkEmailAvailability(normalizedEmail);
        if (!emailAvailable) {
          errors.email = "An account with this email already exists.";
        }
        return errors;
      },
    });
  };
  
// Errors slik at vi kan stoppe innsending til backend hvis det er en feil
    useEffect(() => {
      console.log("Akkurat nå, errors:", errors);
    }, [errors]);
  // Redirect til login etter registrering
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
  
      <form onSubmit={handleAttemptSubmit} className="mt-6 grid grid-cols-3 gap-x-6 gap-y-4 items-center w-full max-w-4xl">
  

        <NameFields // Feltene til firstname, middlename og latname
          formData={formData}
          handleChange={handleChange}
          handleBlur={handleBlur}
          errors={errors}
          touchedFields={touchedFields}
        />

        <ContactFields // feltene til epost og telefon
          formData={formData}
          handleChange={handleChange}
          handleBlur={handleBlur}
          errors={errors}
          touchedFields={touchedFields}
        />

        <PasswordFields // passord felt
          formData={formData}
          handleChange={handleChange}
          handleBlur={handleBlur}
          errors={errors}
          touchedFields={touchedFields}
        />

        <LocationFields // country og reigon feltene
          formData={formData}
          handleChange={handleChange}
          handleBlur={handleBlur}
          errors={errors}
          touchedFields={touchedFields}
          countries={countries}
          regions={regions}
          handleCountryChange={async (e) => {
            const selected = e.target.value;
            setFormData((prev) => ({
              ...prev,
              country: selected,
              region: "", // 🔁 nullstill
            }));

            await fetchRegionsForCountry(selected); // ✅ henter regioner for valgt land
          }}
        />

        <DemoFields //birthday og postal
          formData={formData}
          handleChange={handleChange}
          handleBlur={handleBlur}
          errors={errors}
          touchedFields={touchedFields}
        />

          {/* 🔥 SIGN UP BUTTON */}
          <div className="col-span-3 flex flex-col items-center mt-4 space-y-2">
          {(message || errors["general"]) && (
          <div className="text-sm text-center">
            {message && <p className="text-red-500">{message}</p>}
            {errors["general"] && <p className="text-red-500">{errors["general"]}</p>}
          </div>
        )}
        
        <FormButton // Submit-knappen
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