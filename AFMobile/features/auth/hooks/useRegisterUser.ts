// features/auth/hooks/useRegisterUser.ts
import { useState } from "react";
import { registerUserAPI } from "@/features/auth/services/signUpService";
import { FormDataType } from "@shared/types/form";
import { RegisterUserPayloadDTO } from "@/features/auth/models/RegisterUserPayloadDTO";
import { RegisterResponseDTO } from "@/features/auth/models/RegisterResponseDTO";
import { RegistrationErrorCode } from "@/core/errors/ErrorCode";

interface UseRegisterUserProps {
  formData: Record<string, string>;
  countryCodes: Record<string, string>;
  setFormData: React.Dispatch<React.SetStateAction<FormDataType>>;
  setErrors: (errors: Record<string, string>) => void;
  setMessage: (msg: string) => void;
  onSuccess: (response: RegisterResponseDTO) => void;
}

/**
 * ViewModel-logikk for signup-skjemaet.
 * Bygger payload, kaller registerUserAPI (Result-pattern),
 * og mapper feilkoder til UI-feilmeldinger.
 * @returns registerUser-funksjon og isSubmitting-flag
 */
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

    const countryCode = countryCodes[formData.country] || formData.country;

    const payload: RegisterUserPayloadDTO = {
      email:       formData.email.trim(),
      password:    formData.password,
      firstName:   formData.firstName.trim(),
      lastName:    formData.lastName.trim(),
      phoneNumber: formData.phone?.trim() || "",
      dateOfBirth: formData.dateOfBirth,
      countryCode: countryCode,
    };

    console.log("📦 Sender til API:", JSON.stringify(payload, null, 2));

    const result = await registerUserAPI(payload);

    if (!result.success) {
      switch (result.code) {
        case RegistrationErrorCode.EmailTaken:
          setErrors({ email: "An account with this email already exists." });
          break;
        case RegistrationErrorCode.RateLimited:
        case RegistrationErrorCode.NetworkError:
        case RegistrationErrorCode.InvalidData:
          setErrors({ general: result.error });
          break;
        case RegistrationErrorCode.ServerError:
        case RegistrationErrorCode.Unknown:
        default:
          setErrors({ general: result.error || "Could not register user." });
          break;
      }
      setIsSubmitting(false);
      return;
    }

    console.log("✅ Respons fra API:", result.data);

    // Nullstill skjemaet etter vellykket registrering
    setFormData({
      firstName: "", lastName: "", email: "", password: "",
      confirmPassword: "", dateOfBirth: "", country: "",
      // Beholdt for bakoverkompatibilitet med FormDataType
      middleName: "", phone: "", region: "", postalCode: "", gender: "",
    });

    onSuccess(result.data);
    setIsSubmitting(false);
  };

  return { registerUser, isSubmitting };
}
