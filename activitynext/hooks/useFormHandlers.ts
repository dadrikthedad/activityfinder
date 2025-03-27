import { useState } from "react";
import {
  FieldName,
  validateSingleField,
} from "@/utils/validators";

type FormData = { [key in FieldName]: string };

export function useFormHandlers(initialValues: FormData) {
  const [formData, setFormData] = useState<FormData>(initialValues);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [touchedFields, setTouchedFields] = useState<{ [key in FieldName]?: boolean }>({});
  const [message, setMessage] = useState("");

  const handleChange = (name: FieldName, value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }));

    // Hvis feltet er allerede "touched", så oppdater feilmelding
    if (touchedFields[name]) {
      const error = validateSingleField(name, value, name === "confirmPassword" ? formData.password : undefined);
      setErrors((prevErrors) => ({ ...prevErrors, [name]: error || "" }));
    }
  };

  const handleBlur = (name: FieldName) => {
    setTouchedFields((prev) => ({ ...prev, [name]: true }));

    const value = formData[name];
    const error = validateSingleField(name, value, name === "confirmPassword" ? formData.password : undefined);

    setErrors((prev) => {
      const updated = { ...prev };
      if (error) {
        updated[name] = error;
      } else {
        delete updated[name];
      }

      const stillHasErrors = Object.values(updated).some((val) => val);
      if (!stillHasErrors) {
        setMessage(""); // ✅ Fjern top-message hvis ingen errors igjen
      }

      return updated;
    });
  };

  const validateAllFields = () => {
    const newErrors: Partial<FormData> = {};

    for (const key in formData) {
      const name = key as FieldName;
      const value = formData[name];

      if (!["middleName", "phone", "postalCode"].includes(name)) {
        const error = validateSingleField(name, value, name === "confirmPassword" ? formData.password : undefined);
        if (error) newErrors[name] = error;
      }
    }

    const isValid = Object.keys(newErrors).length === 0;

    return { isValid, errors: newErrors };
  };

  const resetForm = () => {
    setFormData(initialValues);
    setErrors({});
    setTouchedFields({});
    setMessage("");
  };

  return {
    formData,
    setFormData,
    errors,
    setErrors,
    touchedFields,
    setTouchedFields, // ✅ eksponert her
    message,
    setMessage,
    handleChange,
    handleBlur,
    validateAllFields,
    resetForm,
  };
}
