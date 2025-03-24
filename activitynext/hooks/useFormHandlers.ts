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
      setErrors((prevErrors) => ({ ...prevErrors, [name]: error || "" }));
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
      return updated;
    });
  };

  const validateAllFields = () => {
    const allTouched: { [key in FieldName]: boolean } = Object.keys(formData).reduce((acc, key) => {
      acc[key as FieldName] = true;
      return acc;
    }, {} as any);
    setTouchedFields(allTouched);

    const newErrors: Partial<FormData> = {};

    for (const key in formData) {
      const name = key as FieldName;
      const value = formData[name];
      if (name !== "middleName" && name !== "phone" && name !== "postalCode") {
        const error = validateSingleField(name, value, name === "confirmPassword" ? formData.password : undefined);
        if (error) newErrors[name] = error;
      }
    }

    setErrors(newErrors);

    if (Object.keys(newErrors).length > 0) {
      setMessage("Please fix all required fields.");
      return false;
    }

    setMessage("");
    return true;
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
