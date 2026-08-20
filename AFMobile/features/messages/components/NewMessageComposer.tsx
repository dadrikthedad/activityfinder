// features/messages/components/NewMessageComposer.tsx
// Tekstfelt + send-knapp nederst i NewMessageScreen.

import React, { useState } from "react";
import { View, TextInput, TouchableOpacity } from "react-native";
import { Send } from "lucide-react-native";
import { useUnistyles } from "react-native-unistyles";
import { useTranslation } from "react-i18next";

interface Props {
  isGroup: boolean;
  isSubmitting: boolean;
  onSend: (text: string) => void;
}

export default function NewMessageComposer({ isGroup, isSubmitting, onSend }: Props) {
  const { theme } = useUnistyles();
  const { t } = useTranslation();
  const [text, setText] = useState("");

  // For gruppe er tekst valgfri, for 1-til-1 kreves tekst
  const canSend = !isSubmitting && (isGroup || text.trim().length > 0);

  const handleSend = () => {
    if (!canSend) return;
    onSend(text);
  };

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "flex-end",
        gap: theme.spacing.sm,
        padding: theme.spacing.sm,
        borderTopWidth: 1,
        borderTopColor: theme.colors.border,
        backgroundColor: theme.colors.background,
      }}
    >
      <TextInput
        value={text}
        onChangeText={setText}
        placeholder={isGroup ? t("newMessage.groupMessagePlaceholder") : t("newMessage.messagePlaceholder")}
        placeholderTextColor={theme.colors.textPlaceholder}
        editable={!isSubmitting}
        multiline
        maxLength={2000}
        textAlignVertical="top"
        selectionColor={theme.colors.primary}
        style={{
          flex: 1,
          borderWidth: 1,
          borderColor: theme.colors.primary,
          borderRadius: theme.radii.md,
          paddingHorizontal: theme.spacing.md,
          paddingVertical: theme.spacing.sm,
          fontSize: theme.typography.md,
          maxHeight: 120,
          color: theme.colors.textPrimary,
          backgroundColor: theme.colors.backgroundInput,
        }}
      />
      <TouchableOpacity
        onPress={handleSend}
        disabled={!canSend}
        style={{
          backgroundColor: canSend ? theme.colors.primary : theme.colors.disabled,
          borderRadius: theme.radii.md,
          paddingHorizontal: theme.spacing.md,
          height: 44,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Send size={22} color={canSend ? theme.colors.onPrimary : theme.colors.disabledText} />
      </TouchableOpacity>
    </View>
  );
}
