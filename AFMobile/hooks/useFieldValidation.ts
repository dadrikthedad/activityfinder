// hooks/useFieldValidation.ts
import { useState } from "react";
import { FieldName, validateSingleField } from "@shared/utils/validators";
import { FormDataType } from "@shared/types/form";

// Felt som ikke skal valideres ved submit — ikke i UI eller skjulte
const SKIP_VALIDATION = ["middleName", "postalCode", "region", "gender", "city"];

export function useFieldValidation(formData: FormDataType) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touchedFields, setTouchedFields] = useState<Partial<Record<FieldName, boolean>>>({});
  const [message, setMessage] = useState("");

  // Brukes når vi går ut ifra et felt og validerer da feltet
  const handleBlur = (name: FieldName) => {
    setTouchedFields((prev) => ({ ...prev, [name]: true }));

    const value = formData[name] ?? "";
    const error = validateSingleField(name, value, name === "confirmPassword" ? formData.password : undefined);

    setErrors((prev) => {
      const updated = { ...prev };
      if (error) {
        updated[name] = error;
      } else {
        delete updated[name];
      }

      const stillHasErrors = Object.values(updated).some((val) => val);
      if (!stillHasErrors) setMessage("");

      return updated;
    });
  };

  // Ved submit — itererer alle felt og validerer, hopper over skjulte felt
  const validateAllFields = () => {
    const newErrors: Partial<FormDataType> = {};

    for (const key in formData) {
      const name = key as FieldName;
      const value = formData[name] ?? "";

      if (!SKIP_VALIDATION.includes(name)) {
        const error = validateSingleField(name, value, name === "confirmPassword" ? formData.password : undefined);
        if (error) newErrors[name] = error;
      }
    }

    const isValid = Object.keys(newErrors).length === 0;
    return { isValid, errors: newErrors };
  };

  return {
    errors,
    setErrors,
    touchedFields,
    setTouchedFields,
    message,
    setMessage,
    handleBlur,
    validateAllFields,
  };
}
