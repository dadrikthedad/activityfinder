import { useState } from "react";
import { RegisterUserPayload, registerUserAPI } from "@/services/user";
import { FormDataType } from "@/types/form";

interface UseRegisterUserProps {
  formData: Record<string, string>;
  countryCodes: Record<string, string>;
  setFormData: React.Dispatch<React.SetStateAction<FormDataType>>;
  setErrors: (errors: Record<string, string>) => void;
  setMessage: (msg: string) => void;
  onSuccess: () => void;
}

export function useRegisterUser({
  formData,
  countryCodes,
  setFormData,
  setErrors,
  setMessage,
  onSuccess,
}: UseRegisterUserProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const registerUser = async () => {
    setMessage("");
    if (isSubmitting) return;
    setIsSubmitting(true);

    const payload = {
      ...formData,
      country: countryCodes[formData.country] || formData.country,
    } as Partial<RegisterUserPayload>;

    if (!payload.phone?.trim()) delete payload.phone;
    if (
      !formData.region ||
      ["null", "No regions available", "-- Choose --"].includes(formData.region)
    ) {
      delete payload.region;
    }

    try {
      console.log("📦 Sender følgende til API:", JSON.stringify(payload, null, 2));
      const data = await registerUserAPI(payload as RegisterUserPayload);
      console.log("✅ Respons fra API:", data);

      // Nullstill skjema
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
