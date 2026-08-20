import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { useUnistyles } from "react-native-unistyles";
import ButtonNative from "../buttons/ButtonNative";
import { useModal } from "@/context/ModalContext";

interface Action {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "muted" | "danger" | "outline" | "ghost";
}

interface TriggerConfig {
  type: "dots" | "button";
  text?: string;
  variant?: "primary" | "secondary" | "muted" | "danger" | "outline" | "ghost" | "dots";
  size?: "small" | "medium" | "large";
  fullWidth?: boolean;
  disabled?: boolean;
}

interface ActionSheetModalNativeProps {
  title: string;
  actions: Action[];
  trigger: TriggerConfig;
  customTrigger?: React.ReactElement<{ onPress?: () => void }>;
  blurBackground?: boolean;
}

function ActionSheetContent({
  title,
  actions,
  onClose,
  onActionPress,
}: {
  title: string;
  actions: Action[];
  onClose: () => void;
  onActionPress: (action: Action) => void;
}) {
  const { theme } = useUnistyles();

  return (
    <View
      style={{
        backgroundColor: theme.colors.surface,
        borderTopLeftRadius: theme.radii.lg,
        borderTopRightRadius: theme.radii.lg,
        borderTopWidth: 1,
        borderTopColor: theme.colors.border,
        borderLeftWidth: 1,
        borderRightWidth: 1,
        borderColor: theme.colors.border,
        paddingHorizontal: theme.spacing.md,
        paddingTop: 20,
        paddingBottom: theme.spacing.md,
        minHeight: 200,
        width: "100%",
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.15,
        shadowRadius: 4,
        elevation: 5,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: theme.spacing.lg,
          paddingBottom: theme.spacing.md,
          borderBottomWidth: 1,
          borderBottomColor: theme.colors.border,
        }}
      >
        <View style={{ width: 40 }} />
        <View style={{ flex: 1, alignItems: "center" }}>
          <Text
            style={{
              fontSize: theme.typography.lg,
              fontWeight: theme.typography.semibold,
              color: theme.colors.textPrimary,
            }}
          >
            {title}
          </Text>
        </View>
        <TouchableOpacity
          onPress={onClose}
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: theme.colors.primary,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text
            style={{
              fontSize: theme.typography.lg,
              color: theme.colors.onPrimary,
              fontWeight: theme.typography.semibold,
            }}
          >
            ✕
          </Text>
        </TouchableOpacity>
      </View>

      <View style={{ gap: theme.spacing.sm }}>
        {actions.map((action, idx) => (
          <ButtonNative
            key={idx}
            text={action.label}
            onPress={() => onActionPress(action)}
            variant={action.variant ?? "primary"}
            fullWidth
            disabled={action.disabled}
          />
        ))}
      </View>

      <View style={{ height: 34 }} />
    </View>
  );
}

export default function ActionSheetModalNative({
  title,
  actions,
  trigger,
  customTrigger,
  blurBackground = true,
}: ActionSheetModalNativeProps) {
  const { showModal, hideModal } = useModal();

  const handleActionPress = (action: Action) => {
    if (action.disabled) return;
    hideModal();
    setTimeout(() => action.onPress(), 100);
  };

  const handleToggle = () => {
    showModal(
      <ActionSheetContent
        title={title}
        actions={actions}
        onClose={hideModal}
        onActionPress={handleActionPress}
      />,
      { blurBackground, dismissOnBackdrop: true, type: "bottom" }
    );
  };

  if (customTrigger) {
    return React.cloneElement(
      customTrigger as React.ReactElement<{ onPress?: () => void }>,
      { onPress: handleToggle }
    );
  }

  if (trigger.type === "dots") {
    return (
      <ButtonNative
        onPress={handleToggle}
        variant="dots"
        size={trigger.size ?? "small"}
        disabled={trigger.disabled}
      />
    );
  }

  return (
    <ButtonNative
      text={trigger.text ?? "Options"}
      onPress={handleToggle}
      variant={trigger.variant ?? "primary"}
      size={trigger.size ?? "medium"}
      fullWidth={trigger.fullWidth}
      disabled={trigger.disabled}
    />
  );
}
