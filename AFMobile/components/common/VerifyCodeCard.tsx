// components/common/VerifyCodeCard.tsx
import React, { useState, useEffect } from "react";
import { View, Text, TextInput, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useUnistyles } from "react-native-unistyles";
import { useTranslation } from "react-i18next";
import { formatTime } from "@/utils/formatTime";
import ButtonNative from "@/components/common/buttons/ButtonNative";

type Props = {
  title: string;
  description: string;
  onVerify: (code: string) => Promise<void>;
  onResend: () => Promise<void>;
  isSubmitting: boolean;
  initialCooldown?: number;
};

export default function VerifyCodeCard({
  title,
  description,
  onVerify,
  onResend,
  isSubmitting,
  initialCooldown = 0,
}: Props) {
  const { theme } = useUnistyles();
  const { t } = useTranslation();

  const [code, setCode] = useState("");
  const [resendCooldown, setResendCooldown] = useState(initialCooldown);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (resendCooldown > 0) {
      timer = setInterval(() => setResendCooldown((prev) => prev - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const handleVerify = async () => {
    await onVerify(code);
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    await onResend();
    setResendCooldown(120);
  };

  return (
    <View
      style={{
        backgroundColor: theme.colors.surface,
        borderRadius: theme.radii.lg,
        padding: theme.spacing.lg,
        gap: theme.spacing.md,
      }}
    >
      <Text
        style={{
          fontSize: theme.typography.lg,
          fontWeight: theme.typography.semibold,
          color: theme.colors.textPrimary,
          textAlign: "center",
        }}
      >
        {title}
      </Text>

      <Text
        style={{
          fontSize: theme.typography.sm,
          color: theme.colors.textSecondary,
          textAlign: "center",
        }}
      >
        {description}
      </Text>

      <TextInput
        style={{
          borderWidth: 2,
          borderColor: theme.colors.border,
          borderRadius: theme.radii.md,
          padding: theme.spacing.md,
          fontSize: 24,
          textAlign: "center",
          letterSpacing: 4,
          backgroundColor: theme.colors.backgroundInput,
          color: theme.colors.textPrimary,
        }}
        value={code}
        onChangeText={(text) => setCode(text.replace(/[^0-9]/g, ""))}
        placeholder="123456"
        placeholderTextColor={theme.colors.textPlaceholder}
        keyboardType="numeric"
        maxLength={6}
        editable={!isSubmitting}
      />

      <ButtonNative
        text={t("common.confirm")}
        loadingText={t("auth.verifying")}
        onPress={handleVerify}
        loading={isSubmitting}
        disabled={code.length !== 6 || isSubmitting}
        variant="primary"
        size="large"
        fullWidth
      />

      <View
        style={{
          alignItems: "center",
          paddingTop: theme.spacing.sm,
          borderTopWidth: 1,
          borderTopColor: theme.colors.border,
        }}
      >
        <TouchableOpacity
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: theme.spacing.xs,
            padding: theme.spacing.sm,
            borderRadius: theme.radii.md,
            borderWidth: 1,
            borderColor: resendCooldown > 0 ? theme.colors.border : theme.colors.primary,
            backgroundColor: resendCooldown > 0 ? theme.colors.backgroundAlt : theme.colors.surface,
          }}
          onPress={handleResend}
          disabled={resendCooldown > 0 || isSubmitting}
        >
          <Ionicons
            name="refresh"
            size={16}
            color={resendCooldown > 0 ? theme.colors.textMuted : theme.colors.primary}
          />
          <Text
            style={{
              color: resendCooldown > 0 ? theme.colors.textMuted : theme.colors.primary,
              fontSize: theme.typography.sm,
              fontWeight: theme.typography.medium,
            }}
          >
            {resendCooldown > 0
              ? t("auth.resendIn", { time: formatTime(resendCooldown) })
              : t("auth.sendAgain")}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
