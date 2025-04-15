// Denne brukes for å sende en ny bruker som API til backend etter opprettelse
import { useState } from "react";
import { RegisterUserPayload, registerUserAPI } from "@/services/user";
import { FormDataType } from "@/types/form";

interface UseRegisterUserProps {
  formData: Record<string, string>; // Alle feltene fra skjemaet som skal brukes for å opprette en bruker
  countryCodes: Record<string, string>; // Denne bruker for å hente landkode fra valgt land
  setFormData: React.Dispatch<React.SetStateAction<FormDataType>>; // Setter nye verdier i skjemaet
  setErrors: (errors: Record<string, string>) => void; // Ved valideringsfeil
  setMessage: (msg: string) => void; 
  onSuccess: () => void; // Hva som skjer ved suksess, i signup så kommer det en modal
}

export function useRegisterUser({
  formData,
  countryCodes,
  setFormData,
  setErrors,
  setMessage,
  onSuccess,
}: UseRegisterUserProps) {
  const [isSubmitting, setIsSubmitting] = useState(false); // her note

  const registerUser = async () => { 
    setMessage(""); // Resetter message og stopper om registersuer allerede kjører
    if (isSubmitting) return;
    setIsSubmitting(true);

    const payload = { // Her lagrer vi payloaden som skal sendes til Api
      ...formData,
      country: countryCodes[formData.country] || formData.country,
    } as Partial<RegisterUserPayload>;

    if (!payload.phone?.trim()) delete payload.phone; // trimmer telefonnummer
    if (
      !formData.region ||
      ["null", "No regions available", "-- Choose --"].includes(formData.region) // Fjerner unødvendig felter hvis regione mangler region
    ) {
      delete payload.region;
    }

    try {
      console.log("📦 Sender følgende til API:", JSON.stringify(payload, null, 2)); // Her sender vi payload i json til backend
      const data = await registerUserAPI(payload as RegisterUserPayload); // Her sender vi API til backend
      console.log("✅ Respons fra API:", data);

      // Nullstill skjema hvis alt går bra
      setFormData({
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

      onSuccess(); // trigger modal + redirect
    } catch (error: unknown) {
      console.error("❌ Feil under registrering:", error);
    
      if (error instanceof Error) {
        setErrors({ general: error.message || "Could not register user." });
      } else {
        setErrors({ general: "Unknown error occurred during registration." });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return { registerUser, isSubmitting };
}
