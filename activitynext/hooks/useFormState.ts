import { useState } from "react";
import { FormDataType } from "@/types/form";

export function useFormState(initialValues: FormDataType) {
  const [formData, setFormData] = useState<FormDataType>(initialValues);

  const resetForm = () => {
    setFormData(initialValues);
  };

  return {
    formData,
    setFormData,
    resetForm,
  };
}
