// ModalContext.tsx - Oppdatert med bottom sheet støtte
import React, { createContext, useContext, useState, ReactNode } from 'react';
import {
  Modal,
  View,
  TouchableWithoutFeedback,
  StyleSheet,
  Dimensions,
  StatusBar
} from 'react-native';
import { toastConfig } from '@/components/toast/NotificationToastNative';
import Toast from 'react-native-toast-message';

interface ModalContextType {
  showModal: (content: ReactNode, options?: {
    blurBackground?: boolean;
    position?: { x: number; y: number };
    dismissOnBackdrop?: boolean;
    type?: 'center' | 'bottom'; // Nytt alternativ
  }) => void;
  hideModal: () => void;
  isModalOpen: boolean;
}

const ModalContext = createContext<ModalContextType | undefined>(undefined);

export const ModalProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [modalContent, setModalContent] = useState<ReactNode | null>(null);
  const [blurBackground, setBlurBackground] = useState(true);
  const [dismissOnBackdrop, setDismissOnBackdrop] = useState(true);
  const [modalPosition, setModalPosition] = useState<{ x: number; y: number } | null>(null);
  const [modalType, setModalType] = useState<'center' | 'bottom'>('center'); // Nytt state
 
  const isModalOpen = modalContent !== null;

  const showModal = (content: ReactNode, options?: {
    blurBackground?: boolean;
    position?: { x: number; y: number };
    dismissOnBackdrop?: boolean;
    type?: 'center' | 'bottom';
  }) => {
    setModalContent(content);
    setBlurBackground(options?.blurBackground !== false);
    setModalPosition(options?.position ?? null);
    setDismissOnBackdrop(options?.dismissOnBackdrop !== false);
    setModalType(options?.type ?? 'center'); // Sett modal type
  };

  const hideModal = () => {
    setModalContent(null);
    setModalPosition(null);
    setModalType('center');
  };

  const handleBackdropPress = () => {
    if (dismissOnBackdrop) {
      hideModal();
    }
  };

  // Velg riktig container style basert på modal type
  const getContainerStyle = () => {
    if (modalPosition) {
      return {
        position: 'absolute' as const,
        left: modalPosition.x,
        top: modalPosition.y
      };
    }
    
    if (modalType === 'bottom') {
      return [styles.bottomContent, { opacity: isModalOpen ? 1 : 0 }]; // Forhindrer flash
    }
    
    return styles.centeredContent;
  };

  return (
    <ModalContext.Provider value={{ showModal, hideModal, isModalOpen }}>
      {children}
     
      <Modal
        visible={isModalOpen}
        transparent={true}
        animationType={modalType === 'bottom' ? 'slide' : 'fade'} // Forskjellig animasjon
        onRequestClose={hideModal}
        statusBarTranslucent={true}
      >
        <TouchableWithoutFeedback onPress={handleBackdropPress}>
          <View style={[
            styles.overlay,
            blurBackground && styles.blurBackground,
            modalType === 'bottom' && styles.bottomOverlay // Ny style for bottom
          ]}>
            <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
              <View style={getContainerStyle()}>
                {modalContent}
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
        <Toast config={toastConfig} />
      </Modal>
    </ModalContext.Provider>
  );
};

export const useModal = (): ModalContextType => {
  const context = useContext(ModalContext);
  if (!context) {
    throw new Error('useModal must be used within a ModalProvider');
  }
  return context;
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  blurBackground: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  centeredContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Nye styles for bottom sheet
  bottomOverlay: {
    justifyContent: 'flex-end',
    alignItems: 'stretch', // Tar full bredde
  },
  bottomContent: {
    width: '100%',
    justifyContent: 'flex-end',
  },
});