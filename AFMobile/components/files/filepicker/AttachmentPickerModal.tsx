import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Camera, Image as ImageLucid, FileText, Trash2 } from 'lucide-react-native';
import { useUnistyles } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';

interface AttachmentPickerModalProps {
  visible: boolean;
  onClose: () => void;
  onCamera: () => void;
  onImagePicker: () => void;
  onDocumentPicker: () => void;
  showDocuments?: boolean;
  title?: string;
  showRemove?: boolean;
  onRemove?: () => void;
  removeText?: string;
}

export const AttachmentPickerModal: React.FC<AttachmentPickerModalProps> = ({
  visible,
  onClose,
  onCamera,
  onImagePicker,
  onDocumentPicker,
  showDocuments = true,
  title,
  showRemove = false,
  onRemove,
  removeText,
}) => {
  const { theme } = useUnistyles();
  const { t } = useTranslation();

  const handleRemove = () => {
    onRemove?.();
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.modalOverlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <View style={[styles.modalContent, { backgroundColor: theme.colors.surface }]}>
          {title && (
            <View style={[styles.modalHeader, { borderBottomColor: theme.colors.border }]}>
              <Text style={[styles.modalTitle, { color: theme.colors.textPrimary, fontSize: theme.typography.lg, fontWeight: theme.typography.semibold }]}>
                {title}
              </Text>
            </View>
          )}

          <TouchableOpacity style={styles.modalOption} onPress={onCamera}>
            <Camera size={24} color={theme.colors.primary} />
            <Text style={[styles.modalOptionText, { color: theme.colors.textPrimary, fontSize: theme.typography.md, fontWeight: theme.typography.medium }]}>
              {t('common.takePhoto')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.modalOption} onPress={onImagePicker}>
            <ImageLucid size={24} color={theme.colors.primary} />
            <Text style={[styles.modalOptionText, { color: theme.colors.textPrimary, fontSize: theme.typography.md, fontWeight: theme.typography.medium }]}>
              {t('common.chooseFromLibrary')}
            </Text>
          </TouchableOpacity>

          {showDocuments && (
            <TouchableOpacity style={styles.modalOption} onPress={onDocumentPicker}>
              <FileText size={24} color={theme.colors.primary} />
              <Text style={[styles.modalOptionText, { color: theme.colors.textPrimary, fontSize: theme.typography.md, fontWeight: theme.typography.medium }]}>
                {t('common.selectFile')}
              </Text>
            </TouchableOpacity>
          )}

          {showRemove && onRemove && (
            <>
              <View style={[styles.separator, { backgroundColor: theme.colors.border }]} />
              <TouchableOpacity style={styles.modalOption} onPress={handleRemove}>
                <Trash2 size={24} color={theme.colors.error} />
                <Text style={[styles.modalOptionText, { color: theme.colors.error, fontSize: theme.typography.md, fontWeight: theme.typography.medium }]}>
                  {removeText ?? t('common.delete')}
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingVertical: 20,
    paddingHorizontal: 16,
  },
  modalHeader: {
    paddingBottom: 12,
    borderBottomWidth: 1,
    marginBottom: 8,
  },
  modalTitle: {
    textAlign: 'center',
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    gap: 16,
  },
  modalOptionText: {},
  separator: {
    height: 1,
    marginHorizontal: 16,
    marginVertical: 8,
  },
});
