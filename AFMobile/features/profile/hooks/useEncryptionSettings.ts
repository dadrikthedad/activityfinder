import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { CryptoService } from "@/components/ende-til-ende/CryptoService";
import { CryptoServiceBackup } from "@/components/ende-til-ende/CryptoServiceBackup";
import { verifyPassword } from "@/services/user/userService";

export type EncryptionSettingsPhase =
  | "password-gate"
  | "menu"
  | "confirm-reset"
  | "resetting"
  | "error";

export interface UseEncryptionSettingsReturn {
  phase: EncryptionSettingsPhase;
  backupPhrase: string | null;
  showBackupPhraseModal: boolean;
  isLoading: boolean;
  errorMessage: string | null;
  showRestoreModal: boolean;
  restoreMode: "normal" | "old";
  handleVerifyPassword: (password: string) => Promise<void>;
  handleShowPhrase: () => Promise<void>;
  handleCloseBackupPhraseModal: () => void;
  handleConfirmReset: () => void;
  handleCancelReset: () => void;
  handleCreateNewKeys: () => Promise<void>;
  handleOpenRestoreModal: (mode: "normal" | "old") => void;
  handleCloseRestoreModal: () => void;
  handleRestoreComplete: () => void;
}

const SESSION_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutter

export function useEncryptionSettings(): UseEncryptionSettingsReturn {
  const { userId } = useAuth();

  const [phase, setPhase] = useState<EncryptionSettingsPhase>("password-gate");
  const [backupPhrase, setBackupPhrase] = useState<string | null>(null);
  const [showBackupPhraseModal, setShowBackupPhraseModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [restoreMode, setRestoreMode] = useState<"normal" | "old">("normal");
  const sessionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearSessionTimer = () => {
    if (sessionTimerRef.current) {
      clearTimeout(sessionTimerRef.current);
      sessionTimerRef.current = null;
    }
  };

  const startSessionTimer = () => {
    clearSessionTimer();
    sessionTimerRef.current = setTimeout(() => {
      setPhase("password-gate");
      setBackupPhrase(null);
      setShowBackupPhraseModal(false);
    }, SESSION_TIMEOUT_MS);
  };

  useEffect(() => {
    return () => clearSessionTimer();
  }, []);

  const cryptoService = CryptoService.getInstance();
  const cryptoBackupService = CryptoServiceBackup.getInstance();

  const handleVerifyPassword = async (password: string) => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const isValid = await verifyPassword(password);
      if (!isValid) {
        setErrorMessage("wrongPassword");
        return;
      }
      if (!userId) {
        setPhase("error");
        setErrorMessage("noUser");
        return;
      }
      setPhase("menu");
      startSessionTimer();
    } catch {
      setErrorMessage("verifyFailed");
    } finally {
      setIsLoading(false);
    }
  };

  const handleShowPhrase = async () => {
    if (!userId) return;
    setIsLoading(true);
    try {
      const privateKey = await cryptoService.getPrivateKeySafe(userId);
      if (!privateKey) {
        setErrorMessage("noKeys");
        return;
      }
      const phrase = await cryptoBackupService.generateBackupPhrase(privateKey);
      setBackupPhrase(phrase);
      setShowBackupPhraseModal(true);
    } catch {
      setErrorMessage("showPhraseFailed");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCloseBackupPhraseModal = () => {
    setShowBackupPhraseModal(false);
    setBackupPhrase(null);
    setPhase("menu");
  };

  const handleConfirmReset = () => {
    setPhase("confirm-reset");
  };

  const handleCancelReset = () => {
    setPhase("menu");
  };

  const handleCreateNewKeys = async () => {
    if (!userId) return;
    setPhase("resetting");
    try {
      await cryptoService.clearPrivateKey(userId);
      cryptoService.clearUserCache(userId);
      const result = await cryptoBackupService.setupE2EEWithBackup(userId);
      setBackupPhrase(result.backupPhrase);
      setShowBackupPhraseModal(true);
      setPhase("menu");
      clearSessionTimer();
    } catch {
      setPhase("error");
      setErrorMessage("createKeysFailed");
    }
  };

  const handleOpenRestoreModal = (mode: "normal" | "old") => {
    setRestoreMode(mode);
    setShowRestoreModal(true);
  };

  const handleCloseRestoreModal = () => {
    setShowRestoreModal(false);
  };

  const handleRestoreComplete = () => {
    setShowRestoreModal(false);
    setPhase("menu");
  };

  return {
    phase,
    backupPhrase,
    showBackupPhraseModal,
    isLoading,
    errorMessage,
    showRestoreModal,
    restoreMode,
    handleVerifyPassword,
    handleShowPhrase,
    handleCloseBackupPhraseModal,
    handleConfirmReset,
    handleCancelReset,
    handleCreateNewKeys,
    handleOpenRestoreModal,
    handleCloseRestoreModal,
    handleRestoreComplete,
  };
}
