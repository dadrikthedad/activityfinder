import { useFormState } from "./useFormState";
import { useFieldValidation } from "./useFieldValidation";
import { validateSingleField } from "@/utils/validators";
import { FieldName } from "@/utils/validators";
import { FormDataType } from "@/types/form";

export function useFormHandlers(initialValues: FormDataType) {
  const { formData, setFormData, resetForm } = useFormState(initialValues);
  const {
    errors,
    setErrors,
    touchedFields,
    setTouchedFields,
    message,
    setMessage,
    handleBlur,
    validateAllFields,
  } = useFieldValidation(formData);
  

  const handleChange = (name: FieldName, value: string) => {
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
