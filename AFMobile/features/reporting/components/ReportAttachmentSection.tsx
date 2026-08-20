import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { useUnistyles } from "react-native-unistyles";
import { useTranslation } from "react-i18next";
import { RNFile } from "@/utils/files/FileFunctions";
import { AttachmentPicker } from "@/components/files/filepicker/AttachmentPicker";

interface ReportAttachment {
  name: string;
  uri: string;
  type: string;
}

interface Props {
  attachments: ReportAttachment[];
  canAddMore: boolean;
  onRemove: (index: number) => void;
  onFilesSelected: (files: RNFile[]) => void;
  addButtonText: string;
  limitText: string;
  label: string;
}

export function ReportAttachmentSection({
  attachments,
  canAddMore,
  onRemove,
  onFilesSelected,
  addButtonText,
  limitText,
  label,
}: Props) {
  const { theme } = useUnistyles();
  const { t } = useTranslation();

  return (
    <View style={{ gap: theme.spacing.xs }}>
      <Text style={{ fontSize: theme.typography.sm, color: theme.colors.textSecondary }}>
        {label}
      </Text>

      {attachments.map((file, index) => (
        <View
          key={index}
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            padding: theme.spacing.sm,
            backgroundColor: theme.colors.surface,
            borderRadius: theme.radii.sm,
            borderWidth: 1,
            borderColor: theme.colors.border,
          }}
        >
          <Text
            numberOfLines={1}
            style={{
              flex: 1,
              fontSize: theme.typography.sm,
              color: theme.colors.textPrimary,
              marginRight: theme.spacing.sm,
            }}
          >
            {file.name}
          </Text>
          <TouchableOpacity onPress={() => onRemove(index)}>
            <Text style={{ color: theme.colors.error, fontSize: theme.typography.sm }}>
              {t("common.delete")}
            </Text>
          </TouchableOpacity>
        </View>
      ))}

      {canAddMore && (
        <AttachmentPicker
          useNativeButton
          buttonText={addButtonText}
          nativeButtonProps={{ variant: "outline", size: "medium" }}
          onFilesSelected={onFilesSelected}
        />
      )}

      <Text style={{ fontSize: theme.typography.xs, color: theme.colors.textMuted }}>
        {limitText}
      </Text>
    </View>
  );
}
