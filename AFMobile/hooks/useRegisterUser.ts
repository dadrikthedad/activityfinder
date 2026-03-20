// hooks/useRegisterUser.ts
import { useState } from "react";
import { registerUserAPI } from "@/services/user/signUpService";
import { FormDataType } from "@shared/types/form";
import { RegisterUserPayloadDTO } from "@shared/types/auth/RegisterUserPayloadDTO";
import { RegisterResponseDTO } from "@shared/types/auth/RegisterResponseDTO";

// Gender enum — tilsvarer AFBack.Features.Profile.Enums.Gender
// Male = 0, Female = 1, Unspecified = 2
const GenderMap: Record<string, number> = {
  male:        0,
  female:      1,
  unspecified: 2,
  other:       2, // Mapper "other" til Unspecified
  unknown:     2,
  "":          2,
};

interface UseRegisterUserProps {
  formData: Record<string, string>;
  countryCodes: Record<string, string>;
  setFormData: React.Dispatch<React.SetStateAction<FormDataType>>;
  setErrors: (errors: Record<string, string>) => void;
  setMessage: (msg: string) => void;
  onSuccess: (response: RegisterResponseDTO) => void;
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

    try {
      // Bygg payload som matcher AFBack SignupRequest
      const countryCode = countryCodes[formData.country] || formData.country;
      const genderValue = GenderMap[formData.gender?.toLowerCase()] ?? 2;

      const payload: RegisterUserPayloadDTO = {
        email:       formData.email.trim(),
        password:    formData.password,
        firstName:   formData.firstName.trim(),
        lastName:    formData.lastName.trim(),
        phoneNumber: formData.phone.trim(),
        dateOfBirth: formData.dateOfBirth, // ISO 8601: "1990-01-15"
        gender:      genderValue,
        countryCode: countryCode,
        region:      formData.region,
        city:        formData.city?.trim() || undefined,
        postalCode:  formData.postalCode?.trim() || undefined,
      };

      // Fjern valgfrie felter hvis de er tomme
      if (!payload.city)       delete payload.city;
      if (!payload.postalCode) delete payload.postalCode;

      // Fjern region hvis ugyldig verdi
      if (
        !payload.region ||
        ["null", "No regions available", "-- Choose --"].includes(payload.region)
      ) {
        delete (payload as Partial<RegisterUserPayloadDTO>).region;
      }

      console.log("📦 Sender til API:", JSON.stringify(payload, null, 2));
      const response = await registerUserAPI(payload);
      console.log("✅ Respons fra API:", response);

      // Nullstill skjema
      setFormData({
        firstName:       "",
        middleName:      "",
        lastName:        "",
        email:           "",
        password:        "",
        confirmPassword: "",
        phone:           "",
        dateOfBirth:     "",
        country:         "",
        region:          "",
        postalCode:      "",
        gender:          "",
      });

      onSuccess(response);
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
