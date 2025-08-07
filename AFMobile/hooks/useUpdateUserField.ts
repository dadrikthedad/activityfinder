// Her oppdatere felt fra profilesettings til backend. Vi sender API til backend med endringene samt sjekker om det er noen feil eller om vi har submittet eller ikke.

import { useState } from "react";
import { updateUser } from "@/services/user/updateUser";
import { useAuth } from "../context/AuthContext";

// Importer typen direkte fra updateUser-filen
import type { UpdateFieldArgs } from "@/services/user/updateUser";

export function useUpdateUserField() {
  const { token } = useAuth(); // Sjekker om vi er har riktig token
  const [isSubmitting, setSubmitting] = useState(false); // Sjekker om vi submitter
  const [error, setError] = useState(""); // Error ved feil
  const [success, setSuccess] = useState(false);

  type UpdateFieldKey = keyof UpdateFieldArgs; // Denne iterer over hvert felt og gjør om typen til nøkkelen, og da se det slik ut type UpdateFieldKey = "username" | "email" | "profileImage";

  const updateField = async <K extends UpdateFieldKey>( // denne tar imot feltet som skal oppdateres. og den sjekker feks hvis field er email, så må value være en string
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
      await updateUser[field](value, token); // Her bruker vi useUpdateUserField.ts sin funksjon for å oppdatere en brukersetting
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