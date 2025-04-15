// Her håndterer vi et skjemas tilstand, valideringer og endringer. Brukes i Signup, login og editprofiel
import { useFormState } from "./useFormState";
import { useFieldValidation } from "./useFieldValidation";
import { validateSingleField } from "@/utils/validators";
import { FieldName } from "@/utils/validators";
import { FormDataType } from "@/types/form";

export function useFormHandlers(initialValues: FormDataType) {
  const { formData, setFormData, resetForm } = useFormState(initialValues); // Her henter og setter vi skjemaet, og gir mulighet til å nullstille
  const { // Her håndtere vi valideringene, feilmeldingene og om vi har vært innom feltet. useFieldValidation returnerer alle disse variabelne til oss
    errors,
    setErrors,
    touchedFields,
    setTouchedFields,
    message,
    setMessage,
    handleBlur,
    validateAllFields,
  } = useFieldValidation(formData);
  

  const handleChange = (name: FieldName, value: string) => { // Her oppdaterer vi verdien for et felt og vi kjører valdieringer hvis feltet er rørt
    setFormData((prev) => ({ ...prev, [name]: value }));

    if (touchedFields[name]) {
      const error = validateSingleField(name, value, name === "confirmPassword" ? formData.password : undefined);
      setErrors((prevErrors) => ({ ...prevErrors, [name]: error || "" }));
    }
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
