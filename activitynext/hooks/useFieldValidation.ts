// Her sjekker vi enkle felt og alle felt for errors. Vi bruker validatorene fra utils/validators. Sjekker om et felt har vært rørt med handleBlur

import { useState } from "react";
import { FieldName, validateSingleField } from "@/utils/validators";
import { FormDataType } from "@/types/form";

export function useFieldValidation(formData: FormDataType) {
  const [errors, setErrors] = useState<Record<string, string>>({}); // Her holder vi styr på hvem felt som har validerings feil
  const [touchedFields, setTouchedFields] = useState<Partial<Record<FieldName, boolean>>>({}); // Her holder vi styr på om vi har rørt et felt
  const [message, setMessage] = useState(""); // her viser vi error-messagen

  const handleBlur = (name: FieldName) => { // Brukes når vi går ut ifra et felt og validerer da feltet
    setTouchedFields((prev) => ({ ...prev, [name]: true })); // Her setter vi om feltet er røt eller ikke

    const value = formData[name] ?? ""; // Her iterer vi igjennom hver felt i formdata
    const error = validateSingleField(name, value, name === "confirmPassword" ? formData.password : undefined); // Deretter valdirer vi hvert enkelt felt

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

  const validateAllFields = () => { // Ved å trykke på submit så kjører vi validateAllFields som iterer igjennom hvert objekt og valdierer dem.
    const newErrors: Partial<FormDataType> = {};

    for (const key in formData) { // Løkken for å iterere
      const name = key as FieldName;
      const value = formData[name] ?? "";

      if (!["middleName", "phone", "postalCode"].includes(name)) { // Hopper over valgrfri felt
        const error = validateSingleField(name, value, name === "confirmPassword" ? formData.password : undefined);
        if (error) newErrors[name] = error;
      }
    }

    const isValid = Object.keys(newErrors).length === 0; // Hvis alle felt er ugyldig så fjerner vi alle feilene
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
