// utils/form/submitHandler.ts
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
    e.preventDefault();
  
    const allTouched = Object.keys(formData).reduce((acc, key) => {
      acc[key] = true;
      return acc;
    }, {} as Record<string, boolean>);
    setTouchedFields(allTouched);
  
    const { errors: newErrors } = validateAllFields();
  
    if (extraValidation) {
      const extra = await extraValidation();
      Object.assign(newErrors, extra);
    }
  
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      setMessage("Please fix all required fields.");
      return;
    }
  
    setErrors({});
    setMessage("");
    await onSubmit();
  }
  