import { useCallback } from "react";
import { ReactNode } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { useUnistyles } from "react-native-unistyles";
import { useTranslation } from "react-i18next";
import { useModal } from "../context/ModalContext";

export type ConfirmOptions = {
  title?: string;
  message: ReactNode;
};

interface ConfirmDialogContentProps {
  title: string;
  message: ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
}

function ConfirmDialogContent({ title, message, onConfirm, onCancel }: ConfirmDialogContentProps) {
  const { theme } = useUnistyles();
  const { t } = useTranslation();

  return (
    <View style={{
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radii.lg,
      padding: theme.spacing.lg,
      maxWidth: 400,
      width: 300,
      borderWidth: 1,
      borderColor: theme.colors.border,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 12,
      elevation: 8,
    }}>
      <Text style={{
        fontSize: theme.typography.lg,
        fontWeight: theme.typography.semibold,
        color: theme.colors.textPrimary,
        textAlign: "center",
        marginBottom: theme.spacing.md,
      }}>
        {title}
      </Text>

      <View style={{ marginBottom: theme.spacing.lg }}>
        {typeof message === "string" ? (
          <Text style={{
            fontSize: theme.typography.md,
            color: theme.colors.textSecondary,
            textAlign: "center",
            lineHeight: 24,
          }}>
            {message}
          </Text>
        ) : (
          message
        )}
      </View>

      <View style={{ flexDirection: "row", gap: theme.spacing.sm }}>
        <TouchableOpacity
          style={{
            flex: 1,
            paddingVertical: theme.spacing.sm,
            paddingHorizontal: theme.spacing.md,
            borderRadius: theme.radii.md,
            minHeight: 48,
            justifyContent: "center",
            alignItems: "center",
            backgroundColor: theme.colors.backgroundAlt,
            borderWidth: 1,
            borderColor: theme.colors.border,
          }}
          onPress={onCancel}
        >
          <Text style={{
            color: theme.colors.textSecondary,
            fontWeight: theme.typography.semibold,
            fontSize: theme.typography.md,
          }}>
            {t("common.cancel")}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={{
            flex: 1,
            paddingVertical: theme.spacing.sm,
            paddingHorizontal: theme.spacing.md,
            borderRadius: theme.radii.md,
            minHeight: 48,
            justifyContent: "center",
            alignItems: "center",
            backgroundColor: theme.colors.primary,
          }}
          onPress={onConfirm}
        >
          <Text style={{
            color: theme.colors.onPrimary,
            fontWeight: theme.typography.semibold,
            fontSize: theme.typography.md,
          }}>
            {t("common.confirm")}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export function useConfirmModalNative() {
  const { showModal, hideModal } = useModal();

  const confirm = useCallback(
    (options: ConfirmOptions) => {
      return new Promise<boolean>((resolve) => {
        const handleClose = (result: boolean) => {
          resolve(result);
          hideModal();
        };

        showModal(
          <ConfirmDialogContent
            title={options.title ?? "Bekreft"}
            message={options.message}
            onConfirm={() => handleClose(true)}
            onCancel={() => handleClose(false)}
          />,
          { blurBackground: true, dismissOnBackdrop: false }
        );
      });
    },
    [showModal, hideModal]
  );

  return { confirm };
}
