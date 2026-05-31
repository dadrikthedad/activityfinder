// features/auth/hooks/useE2EESetup.ts
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import * as Keychain from "react-native-keychain";
import { getUserIdFromToken } from "@/utils/auth/getUserIdFromToken";
import { CryptoService } from "@/components/ende-til-ende/CryptoService";
import { CryptoServiceBackup } from "@/components/ende-til-ende/CryptoServiceBackup";
import { getMyPublicKey, storeEncryptionKeys } from "@/features/auth/services/encryptionService";
import { E2EESetupErrorCode } from "@/core/errors/ErrorCode";

export type E2EESetupScenario = "loading" | "creating" | "ready" | "restore-needed" | "error" | "error-new-key";

export interface UseE2EESetupReturn {
  scenario: E2EESetupScenario;
  errorMessage: string;
  backupPhrase: string;
  setBackupPhrase: (v: string) => void;
  isRestoring: boolean;
  isCreatingNew: boolean;
  handleRestoreFromPhrase: () => Promise<void>;
  handleCreateNewKeys: () => Promise<void>;
  handleRetryCreate: () => Promise<void>;
}

const KEYCHAIN_KEY = (userId: string) => `e2ee_private_key_${userId}`;

async function getLocalPrivateKey(userId: string): Promise<string | null> {
  try {
    const result = await Keychain.getInternetCredentials(KEYCHAIN_KEY(userId));
    return result ? result.password : null;
  } catch {
    return null;
  }
}

async function storeLocalPrivateKey(userId: string, seed: string): Promise<void> {
  await Keychain.setInternetCredentials(
    KEYCHAIN_KEY(userId),
    userId,
    seed,
    { storage: Keychain.STORAGE_TYPE.AES_GCM_NO_AUTH }
  );
}

export const useE2EESetup = (accessToken: string, refreshToken: string): UseE2EESetupReturn => {
  const { login } = useAuth();

  const [scenario, setScenario] = useState<E2EESetupScenario>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [backupPhrase, setBackupPhrase] = useState("");
  const [isRestoring, setIsRestoring] = useState(false);
  const [isCreatingNew, setIsCreatingNew] = useState(false);

  const userId = getUserIdFromToken(accessToken) ?? "";

  const completeSetup = useCallback(async () => {
    await login(accessToken, refreshToken);
  }, [login, accessToken, refreshToken]);

  useEffect(() => {
    if (!userId) {
      setScenario("error");
      setErrorMessage("Ugyldig token");
      return;
    }

    const runSetup = async () => {
      const cryptoService = CryptoService.getInstance();

      // Sjekk server og lokal nøkkel parallelt
      const [serverKeyResult, localKey] = await Promise.all([
        getMyPublicKey(),
        getLocalPrivateKey(userId),
      ]);

      const hasServerKey = serverKeyResult.success;
      const hasLocalKey = !!localKey;

      // Scenario B — alt OK, gå videre
      if (hasServerKey && hasLocalKey) {
        await completeSetup();
        return;
      }

      // Scenario A — ny bruker, ingen nøkkel noe sted
      if (!hasServerKey) {
        setScenario("creating");
        try {
          const keyPair = await cryptoService.generateKeyPair();
          await storeLocalPrivateKey(userId, keyPair.privateKey);
          const storeResult = await storeEncryptionKeys(keyPair.publicKey, keyPair.privateKey);
          if (!storeResult.success) {
            setScenario("error-new-key");
            setErrorMessage(storeResult.error);
            return;
          }
          await completeSetup();
        } catch {
          setScenario("error-new-key");
          setErrorMessage("Nøkkelgenerering feilet. Prøv igjen.");
        }
        return;
      }

      // Scenario C — server har nøkkel, men ikke denne enheten
      setScenario("restore-needed");
    };

    runSetup();
  }, [userId]);

  const handleRestoreFromPhrase = async () => {
    if (!backupPhrase.trim()) return;
    setIsRestoring(true);
    try {
      const cryptoBackup = CryptoServiceBackup.getInstance();
      const seed = await cryptoBackup.restorePrivateKeyFromPhrase(backupPhrase.trim());
      await storeLocalPrivateKey(userId, seed);
      await completeSetup();
    } catch {
      setErrorMessage("Ugyldig backup-phrase. Sjekk at du har skrevet riktig.");
    } finally {
      setIsRestoring(false);
    }
  };

  const handleRetryCreate = async () => {
    setScenario("creating");
    setErrorMessage("");
    try {
      const cryptoService = CryptoService.getInstance();
      const keyPair = await cryptoService.generateKeyPair();
      await storeLocalPrivateKey(userId, keyPair.privateKey);
      const storeResult = await storeEncryptionKeys(keyPair.publicKey, keyPair.privateKey);
      if (!storeResult.success) {
        setScenario("error-new-key");
        setErrorMessage(storeResult.error);
        return;
      }
      await completeSetup();
    } catch {
      setScenario("error-new-key");
      setErrorMessage("Nøkkelgenerering feilet. Prøv igjen.");
    }
  };

  const handleCreateNewKeys = async () => {
    setIsCreatingNew(true);
    try {
      const cryptoService = CryptoService.getInstance();
      const keyPair = await cryptoService.generateKeyPair();
      await storeLocalPrivateKey(userId, keyPair.privateKey);
      const storeResult = await storeEncryptionKeys(keyPair.publicKey, keyPair.privateKey);
      if (!storeResult.success) {
        setErrorMessage(storeResult.error);
        return;
      }
      await completeSetup();
    } catch {
      setErrorMessage("Nøkkelgenerering feilet. Prøv igjen.");
    } finally {
      setIsCreatingNew(false);
    }
  };

  return {
    scenario,
    errorMessage,
    backupPhrase,
    setBackupPhrase,
    isRestoring,
    isCreatingNew,
    handleRestoreFromPhrase,
    handleCreateNewKeys,
    handleRetryCreate,
  };
};
