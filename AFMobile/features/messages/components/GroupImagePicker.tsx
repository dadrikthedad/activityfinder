// features/messages/components/GroupImagePicker.tsx
// Velger et lokalt gruppebilde (RNFile). Bildet lastes IKKE opp her — det sendes med
// multipart i createGroupConversation.

import React, { useCallback } from "react";
import { View, Text, Image, TouchableOpacity } from "react-native";
import { Camera, Plus, X } from "lucide-react-native";
import { useUnistyles } from "react-native-unistyles";
import { useTranslation } from "react-i18next";
import { RNFile } from "@/utils/files/FileFunctions";
import { useAttachmentPicker } from "@/components/files/filepicker/useAttachmentPicker";
import { AttachmentPickerModal } from "@/components/files/filepicker/AttachmentPickerModal";

interface Props {
  value: RNFile | null;
  onChange: (file: RNFile | null) => void;
}

export default function GroupImagePicker({ value, onChange }: Props) {
  const { theme } = useUnistyles();
  const { t } = useTranslation();

  const handleFilesSelected = useCallback(
    (files: RNFile[]) => {
      if (files.length > 0) onChange(files[0]);
    },
    [onChange],
  );

  const { showPicker, showModal, setShowModal, handleCamera, handleImagePicker, handleDocumentPicker } =
    useAttachmentPicker({
      onFilesSelected: handleFilesSelected,
      allowMultipleImages: false,
      allowVideos: false,
      allowDocuments: false,
      imageQuality: 0.7,
      cameraQuality: 0.7,
    });

  return (
    <View style={{ paddingHorizontal: theme.spacing.md, marginBottom: theme.spacing.lg }}>
      <Text
        style={{
          fontSize: theme.typography.md,
          fontWeight: theme.typography.semibold,
          color: theme.colors.textSecondary,
          marginBottom: theme.spacing.sm,
        }}
      >
        {t("newMessage.groupImageLabel")}
      </Text>

      <View style={{ alignItems: "center", gap: theme.spacing.sm }}>
        {value ? (
          <View>
            <Image source={{ uri: value.uri }} style={{ width: 80, height: 80, borderRadius: 40 }} />
            <TouchableOpacity
              onPress={() => onChange(null)}
              style={{
                position: "absolute",
                top: -8,
                right: -8,
                width: 24,
                height: 24,
                borderRadius: 12,
                backgroundColor: theme.colors.surfaceAlt,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <X size={14} color={theme.colors.textPrimary} />
            </TouchableOpacity>
          </View>
        ) : (
          <View
            style={{
              width: 80,
              height: 80,
              borderRadius: 40,
              borderWidth: 2,
              borderColor: theme.colors.border,
              borderStyle: "dashed",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: theme.colors.backgroundInput,
            }}
          >
            <Plus size={24} color={theme.colors.textMuted} />
          </View>
        )}

        <TouchableOpacity
          onPress={showPicker}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: theme.spacing.sm,
            backgroundColor: theme.colors.primary,
            paddingHorizontal: theme.spacing.md,
            paddingVertical: theme.spacing.sm,
            borderRadius: theme.radii.md,
          }}
        >
          <Camera size={16} color={theme.colors.onPrimary} />
          <Text style={{ color: theme.colors.onPrimary, fontSize: theme.typography.sm, fontWeight: theme.typography.medium }}>
            {t("newMessage.addGroupImage")}
          </Text>
        </TouchableOpacity>
      </View>

      <AttachmentPickerModal
        visible={showModal}
        onClose={() => setShowModal(false)}
        onCamera={handleCamera}
        onImagePicker={handleImagePicker}
        onDocumentPicker={handleDocumentPicker}
        title={t("newMessage.groupImageLabel")}
        showDocuments={false}
      />
    </View>
  );
}
