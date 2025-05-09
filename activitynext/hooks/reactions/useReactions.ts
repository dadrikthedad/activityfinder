// hooken til å sende reaction til backend
import { useState } from "react";
import { addReaction, ReactionRequest } from "@/services/messages/reactionService";

export function useReactions() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAddReaction = async (reaction: ReactionRequest) => {
    setLoading(true);
    setError(null);
    try {
      await addReaction(reaction);
      console.log(`✅ Reaksjon '${reaction.emoji}' sendt for melding ${reaction.messageId}`);
    } catch (err: unknown) {
    if (err instanceof Error) {
        setError(err.message || "Noe gikk galt ved å legge til reaksjon.");
    } else {
        setError("Ukjent feil ved å legge til reaksjon.");
    }
    } finally {
      setLoading(false);
    }
  };


  return {
    addReaction: handleAddReaction,
    loading,
    error,
  };
}