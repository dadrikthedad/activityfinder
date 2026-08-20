import React, { useState } from "react";
import {
  View,
  Text,
  Modal,
  ScrollView,
} from "react-native";
import { useUnistyles } from "react-native-unistyles";
import { useTranslation } from "react-i18next";
import { ShieldCheck, AlertTriangle, CheckCircle, XCircle } from "lucide-react-native";
import * as Clipboard from "expo-clipboard";
import ButtonNative from "@/components/common/buttons/ButtonNative";
import { saveBackupPhraseToDevice } from "@/features/crypto/services/backupPhraseExportService";

interface BackupPhraseModalProps {
  visible: boolean;
  phrase: string;
  onContinue: () => void;
}

export default function BackupPhraseModal({
  visible,
  phrase,
  onContinue,
}: BackupPhraseModalProps) {
  const { theme } = useUnistyles();
  const { t } = useTranslation();
  const [isSaving, setIsSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<"saved" | "error" | null>(null);
  const [copied, setCopied] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    setSaveResult(null);
    try {
      const saved = await saveBackupPhraseToDevice(phrase);
      setSaveResult(saved ? "saved" : null);
    } catch {
      setSaveResult("error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopy = async () => {
    await Clipboard.setStringAsync(phrase);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => {}}
    >
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", alignItems: "center" }}>
        <View style={{
          backgroundColor: theme.colors.surface,
          borderRadius: theme.radii.lg,
          borderWidth: 1,
          borderColor: theme.colors.border,
          maxWidth: 500,
          width: "90%",
          maxHeight: "90%",
        }}>
          <ScrollView
            contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.lg }}
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            {/* Header */}
            <View style={{ alignItems: "center", gap: theme.spacing.md }}>
              <View style={{
                width: 64,
                height: 64,
                borderRadius: 32,
                backgroundColor: theme.colors.primary,
                alignItems: "center",
                justifyContent: "center",
              }}>
                <ShieldCheck size={32} color={theme.colors.onPrimary} />
              </View>
              <Text style={{ fontSize: theme.typography.xl, fontWeight: theme.typography.bold, color: theme.colors.textPrimary, textAlign: "center" }}>
                {t("e2ee.backupPhraseModalTitle")}
              </Text>
              <Text style={{ fontSize: theme.typography.md, color: theme.colors.textSecondary, textAlign: "center", lineHeight: 24 }}>
                {t("e2ee.backupPhraseModalSubtitle")}
              </Text>
            </View>

            {/* Frase-visning */}
            <View style={{
              backgroundColor: theme.colors.backgroundInput,
              borderRadius: theme.radii.md,
              padding: theme.spacing.md,
              borderWidth: 1,
              borderColor: theme.colors.border,
            }}>
              <Text style={{
                fontSize: theme.typography.md,
                fontWeight: theme.typography.medium,
                color: theme.colors.textPrimary,
                textAlign: "center",
                lineHeight: 28,
              }}>
                {phrase}
              </Text>
            </View>

            {/* Advarsel */}
            <View style={{
              flexDirection: "row",
              gap: theme.spacing.sm,
              backgroundColor: theme.colors.backgroundAlt,
              borderRadius: theme.radii.md,
              padding: theme.spacing.md,
              borderWidth: 1,
              borderColor: theme.colors.error,
            }}>
              <AlertTriangle size={18} color={theme.colors.error} style={{ marginTop: 2 }} />
              <Text style={{ flex: 1, fontSize: theme.typography.sm, color: theme.colors.error, lineHeight: 20 }}>
                {t("e2ee.backupPhraseModalWarning")}
              </Text>
            </View>

            {/* Suksess / feil-feedback */}
            {saveResult === "saved" && (
              <View style={{
                flexDirection: "row",
                gap: theme.spacing.sm,
                backgroundColor: theme.colors.backgroundAlt,
                borderRadius: theme.radii.md,
                padding: theme.spacing.md,
                borderWidth: 1,
                borderColor: theme.colors.success,
                alignItems: "center",
              }}>
                <CheckCircle size={18} color={theme.colors.success} />
                <Text style={{ flex: 1, fontSize: theme.typography.sm, color: theme.colors.success, fontWeight: theme.typography.medium }}>
                  {t("e2ee.backupPhraseSavedTitle")} — {t("e2ee.backupPhraseSavedBody")}
                </Text>
              </View>
            )}
            {saveResult === "error" && (
              <View style={{
                flexDirection: "row",
                gap: theme.spacing.sm,
                backgroundColor: theme.colors.backgroundAlt,
                borderRadius: theme.radii.md,
                padding: theme.spacing.md,
                borderWidth: 1,
                borderColor: theme.colors.error,
                alignItems: "center",
              }}>
                <XCircle size={18} color={theme.colors.error} />
                <Text style={{ flex: 1, fontSize: theme.typography.sm, color: theme.colors.error, fontWeight: theme.typography.medium }}>
                  {t("common.error")}
                </Text>
              </View>
            )}

            {/* Knapper */}
            <View style={{ gap: theme.spacing.md }}>
              <ButtonNative
                text={saveResult === "saved" ? t("e2ee.backupPhraseSavedTitle") : t("e2ee.backupPhraseSaveButton")}
                loadingText={t("common.loading")}
                onPress={handleSave}
                loading={isSaving}
                disabled={isSaving}
                variant={saveResult === "saved" ? "secondary" : "primary"}
                size="large"
                fullWidth
              />
              <ButtonNative
                text={copied ? t("e2ee.backupPhraseCopied") : t("e2ee.backupPhraseCopyButton")}
                onPress={handleCopy}
                disabled={isSaving}
                variant="secondary"
                size="large"
                fullWidth
              />
              <ButtonNative
                text={t("e2ee.backupPhraseContinueButton")}
                onPress={onContinue}
                disabled={isSaving}
                variant="secondary"
                size="large"
                fullWidth
              />
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
