import React from 'react';
import { ViewStyle } from 'react-native';
import { useAttachmentPicker, UseAttachmentPickerOptions } from './useAttachmentPicker';
import { AttachmentPickerModal } from './AttachmentPickerModal';
import { AttachmentPickerButton } from './AttachmentPickerButton';
import ButtonNative, { ButtonNativeProps } from '@/components/common/buttons/ButtonNative';

interface AttachmentPickerProps extends UseAttachmentPickerOptions {
  // Original button props (for backward compatibility)
  disabled?: boolean;
  buttonSize?: number;
  buttonColor?: string;
  buttonBackgroundColor?: string;
  buttonStyle?: ViewStyle;
  buttonIcon?: React.ReactNode;
 
  // Modal props
  modalTitle?: string;
  accentColor?: string;
 
  // ButtonNative integration
  useNativeButton?: boolean;
  nativeButtonProps?: Partial<ButtonNativeProps>;
  buttonText?: string;

  // NEW: Remove functionality
  showRemove?: boolean;
  onRemove?: () => void;
  removeText?: string;
}

export const AttachmentPicker: React.FC<AttachmentPickerProps> = ({
  // Original props
  disabled = false,
  buttonSize = 24,
  buttonColor = "#ffffff",
  buttonBackgroundColor = "#1C6B1C",
  buttonStyle,
  buttonIcon,
  modalTitle,
  accentColor = "#1C6B1C",
 
  // ButtonNative props
  useNativeButton = false,
  nativeButtonProps,
  buttonText = "Add Attachment",

  // NEW: Remove props
  showRemove = false,
  onRemove,
  removeText = "Remove Image",
 
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

  const renderButton = () => {
    if (useNativeButton) {
      return (
        <ButtonNative
          text={buttonText}
          onPress={showPicker}
          disabled={disabled}
          variant="primary"
          size="medium"
          {...nativeButtonProps}
        />
      );
    }
    return (
      <AttachmentPickerButton
        onPress={showPicker}
        disabled={disabled}
        size={buttonSize}
        color={buttonColor}
        backgroundColor={buttonBackgroundColor}
        style={buttonStyle}
        icon={buttonIcon}
      />
    );
  };

  return (
    <>
      {renderButton()}
     
      <AttachmentPickerModal
        visible={showModal}
        onClose={() => setShowModal(false)}
        onCamera={handleCamera}
        onImagePicker={handleImagePicker}
        onDocumentPicker={handleDocumentPicker}
        showDocuments={allowDocuments}
        title={modalTitle}
        accentColor={accentColor}
        // NEW: Remove props
        showRemove={showRemove}
        onRemove={onRemove}
        removeText={removeText}
      />
    </>
  );
};