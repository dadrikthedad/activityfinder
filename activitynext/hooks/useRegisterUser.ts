import { useState } from "react";
import { RegisterUserPayload, registerUserAPI } from "@/services/user";

interface UseRegisterUserProps {
  formData: Record<string, string>;
  countryCodes: Record<string, string>;
  setFormData: (data: Record<string, string>) => void;
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
    } catch (error: any) {
      console.error("❌ Feil under registrering:", error);
      setErrors({ general: error.message || "Could not register user." });
    } finally {
      setIsSubmitting(false);
    }
  };

  return { registerUser, isSubmitting };
}
