import React from 'react';
import { ViewStyle } from 'react-native';
import { useAttachmentPicker, UseAttachmentPickerOptions } from './useAttachmentPicker';
import { AttachmentPickerModal } from './AttachmentPickerModal';
import { AttachmentPickerButton } from './AttachmentPickerButton';

interface AttachmentPickerProps extends UseAttachmentPickerOptions {
  disabled?: boolean;
  buttonSize?: number;
  buttonColor?: string;
  buttonBackgroundColor?: string;
  buttonStyle?: ViewStyle;
  modalTitle?: string;
  accentColor?: string;
  buttonIcon?: React.ReactNode;
}

export const AttachmentPicker: React.FC<AttachmentPickerProps> = ({
  disabled = false,
  buttonSize = 24,
  buttonColor = "#ffffff",
  buttonBackgroundColor = "#1C6B1C",
  buttonStyle,
  modalTitle,
  accentColor = "#1C6B1C",
  buttonIcon,
  allowDocuments = true,
  ...pickerOptions
}) => {
  const {
    showPicker,
    showModal,
    setShowModal,
    handleCamera,
    handleImagePicker,
    handleDocumentPicker,
  } = useAttachmentPicker(pickerOptions);

  return (
    <>
      <AttachmentPickerButton
        onPress={showPicker}
        disabled={disabled}
        size={buttonSize}
        color={buttonColor}
        backgroundColor={buttonBackgroundColor}
        style={buttonStyle}
        icon={buttonIcon}
      />
      
      <AttachmentPickerModal
        visible={showModal}
        onClose={() => setShowModal(false)}
        onCamera={handleCamera}
        onImagePicker={handleImagePicker}
        onDocumentPicker={handleDocumentPicker}
        showDocuments={allowDocuments}
        title={modalTitle}
        accentColor={accentColor}
      />
    </>
  );
};