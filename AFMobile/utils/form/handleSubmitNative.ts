// utils/form/handleSubmitNative.ts
// Håndterer hvordan skjemainnsendinger skjer på React Native, håndterer validering, feilmeldinger og om vi har vært i felt. Brukes i Signup
export async function handleSubmitNative({
    formData,
    setTouchedFields,
    validateAllFields,
    extraValidation,
    onSubmit,
    setErrors,
    setMessage,
  }: {
    formData: Record<string, string>;
    setTouchedFields: (fields: Record<string, boolean>) => void;
    validateAllFields: () => { isValid: boolean; errors: Record<string, string> };
    extraValidation?: () => Promise<Record<string, string>>;
    onSubmit: () => Promise<void>;
    setErrors: (e: Record<string, string>) => void;
    setMessage: (m: string) => void;
  }) {
    // React Native har ikke e.preventDefault() - ingen form events
 
    const allTouched = Object.keys(formData).reduce((acc, key) => { // Setter alle felt som rørt hvis vi trykker submit
      acc[key] = true;
      return acc;
    }, {} as Record<string, boolean>);
    setTouchedFields(allTouched);
 
    const { errors: newErrors } = validateAllFields(); // Validerer alle felt
 
    if (extraValidation) { // Bruker ekstra validering hvis det trengs, feks å sjekke om eposten er brukt på serveren
      const extra = await extraValidation();
      Object.assign(newErrors, extra);
    }
 
    if (Object.keys(newErrors).length > 0) { // Hvis det finnes feil så kommer denne feilmeldingen
      setErrors(newErrors);
      setMessage("Please fix all required fields.");
      return;
    }
 
    setErrors({});
    setMessage("");
    await onSubmit();
  }