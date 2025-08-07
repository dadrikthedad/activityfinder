// Håndterer hvordan skjemainnsendinger skjer, håndterer validering, feilmeldinger og om vi har vært ifelt. Brukes i Signup
export async function handleSubmit({
    e,
    formData,
    setTouchedFields,
    validateAllFields,
    extraValidation,
    onSubmit,
    setErrors,
    setMessage,
  }: {
    e: React.FormEvent;
    formData: Record<string, string>;
    setTouchedFields: (fields: Record<string, boolean>) => void;
    validateAllFields: () => { isValid: boolean; errors: Record<string, string> };
    extraValidation?: () => Promise<Record<string, string>>;
    onSubmit: () => Promise<void>;
    setErrors: (e: Record<string, string>) => void;
    setMessage: (m: string) => void;
  }) {
    e.preventDefault(); // stopper å sende inn hvis ingenting er gjort i skjemaet
  
    const allTouched = Object.keys(formData).reduce((acc, key) => { // Setter all felt som rørt hvis vi trykker submit
      acc[key] = true;
      return acc;
    }, {} as Record<string, boolean>);
    setTouchedFields(allTouched);
  
    const { errors: newErrors } = validateAllFields(); // Valdiere alle feil
  
    if (extraValidation) { // Bruker ekstra validering hvis det trengs, og da feks å sjekke om eposten er brukt på serveren
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
  