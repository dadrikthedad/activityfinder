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

    if (touchedFields[name]) {
      const error = validateSingleField(name, value, name === "confirmPassword" ? formData.password : undefined);
      setErrors((prevErrors) => {
        const updated = { ...prevErrors };
        if (error) {
          updated[name] = error;
        } else {
          delete updated[name]; // 🚀 Fjern helt hvis ingen feil
        }
        return updated;
      });
    }
  };

  const handleBlur = (name: FieldName) => {
    setTouchedFields((prev) => ({ ...prev, [name]: true }));
    const value = formData[name];
    const error = validateSingleField(name, value, name === "confirmPassword" ? formData.password : undefined);
  
    setErrors((prev) => {
      const updated = { ...prev };
      if (error) updated[name] = error;
      else delete updated[name];
  
      // 🔍 Sjekk etterpå: finnes det noen errors igjen?
      const stillHasErrors = Object.values(updated).some((val) => val);
      if (!stillHasErrors) setMessage(""); // ✅ Fjern error-melding automatisk!
  
      return updated;
    });
  };

  // Må vi endre slik at vi ikkke bruker any her?
  const validateAllFields = () => {
  const allTouched: { [key in FieldName]: boolean } = Object.keys(formData).reduce((acc, key) => {
    acc[key as FieldName] = true;
    return acc;
  }, {} as { [key in FieldName]: boolean });

  setTouchedFields(allTouched);

  const newErrors: { [key in FieldName]?: string } = {};

  for (const key in formData) {
    const name = key as FieldName;
    const value = formData[name];

    if (!["middleName", "phone", "postalCode"].includes(name)) {
      const error = validateSingleField(name, value, name === "confirmPassword" ? formData.password : undefined);
      if (error) {
        newErrors[name] = error;
      }
    }
  }

  setErrors(newErrors);

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
    setTouchedFields,
    message,
    setMessage,
    handleChange,
    handleBlur,
    validateAllFields,
    resetForm,
  };
}
