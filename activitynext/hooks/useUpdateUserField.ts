import { useState } from "react";
import { updateUser } from "../services/updateUser";
import { useAuth } from "../context/AuthContext";

// 👇 Importer typen direkte fra updateUser-filen
import type { UpdateFieldArgs } from "../services/updateUser";

export function useUpdateUserField() {
  const { token } = useAuth();
  const [isSubmitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  type UpdateFieldKey = keyof UpdateFieldArgs;

  const updateField = async <K extends UpdateFieldKey>(
    field: K,
    value: UpdateFieldArgs[K]
  ): Promise<boolean> => {
    if (!token) {
      setError("You are not authenticated.");
      return false;
    }

    setSubmitting(true);
    setError("");
    setSuccess(false);

    try {
      await updateUser[field](value, token);
      setSuccess(true);
      return true;
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("An unknown error occurred.");
      }
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  return { updateField, isSubmitting, error, success };
}