import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Camera, Image as ImageLucid, FileText, Trash2 } from 'lucide-react-native';

interface AttachmentPickerModalProps {
  visible: boolean;
  onClose: () => void;
  onCamera: () => void;
  onImagePicker: () => void;
  onDocumentPicker: () => void;
  showDocuments?: boolean;
  title?: string;
  accentColor?: string;
  // NEW: Remove functionality
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
  title = "Choose Attachment",
  accentColor = "#1C6B1C",
  // NEW props with defaults
  showRemove = false,
  onRemove,
  removeText = "Remove Image"
}) => {
  const handleRemove = () => {
    onRemove?.();
    onClose(); // Close modal after remove action
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
        <View style={styles.modalContent}>
          {title && (
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{title}</Text>
            </View>
          )}
         
          <TouchableOpacity
            style={styles.modalOption}
            onPress={onCamera}
          >
            <Camera size={24} color={accentColor} />
            <Text style={styles.modalOptionText}>Take Photo</Text>
          </TouchableOpacity>
         
          <TouchableOpacity
            style={styles.modalOption}
            onPress={onImagePicker}
          >
            <ImageLucid size={24} color={accentColor} />
            <Text style={styles.modalOptionText}>Choose from Library</Text>
          </TouchableOpacity>
         
          {showDocuments && (
            <TouchableOpacity
              style={styles.modalOption}
              onPress={onDocumentPicker}
            >
              <FileText size={24} color={accentColor} />
              <Text style={styles.modalOptionText}>Select File</Text>
            </TouchableOpacity>
          )}

          {/* NEW: Remove option */}
          {showRemove && onRemove && (
            <>
              <View style={styles.separator} />
              <TouchableOpacity
                style={styles.modalOption}
                onPress={handleRemove}
              >
                <Trash2 size={24} color="#EF4444" />
                <Text style={[styles.modalOptionText, styles.removeText]}>
                  {removeText}
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
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingVertical: 20,
    paddingHorizontal: 16,
  },
  modalHeader: {
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    textAlign: 'center',
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    gap: 16,
  },
  modalOptionText: {
    fontSize: 16,
    color: '#374151',
    fontWeight: '500',
  },
  // NEW styles
  separator: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginHorizontal: 16,
    marginVertical: 8,
  },
  removeText: {
    color: '#EF4444',
  },
});