// Her håndterer vi skjema vi bruker til signup. Har funksjon for å resettes
import { useState } from "react";
import { FormDataType } from "@/types/form";

export function useFormState(initialValues: FormDataType) {
  const [formData, setFormData] = useState<FormDataType>(initialValues); // setFormData brukes til å oppdatere skjemaet senere

  const resetForm = () => { //Brukes for å resette skjemaet
    setFormData(initialValues);
  };

  return {
    formData,
    setFormData,
    resetForm,
  };
}
