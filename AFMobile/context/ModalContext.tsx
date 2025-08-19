// ModalContext.tsx - Oppdatert med bedre støtte for modal størrelser
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
    type?: 'center' | 'bottom';
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
  const [modalType, setModalType] = useState<'center' | 'bottom'>('center');
 
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
    setModalType(options?.type ?? 'center');
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
      return [styles.bottomContent, { opacity: isModalOpen ? 1 : 0 }];
    }
    
    // For center modaler, la innholdet selv bestemme størrelsen
    return styles.centeredContent;
  };

  const getOverlayStyle = () => {
    const baseStyle = [
      styles.overlay,
      blurBackground && styles.blurBackground,
    ];

    if (modalType === 'bottom') {
      return [...baseStyle, styles.bottomOverlay];
    }

    // For center modaler, bruk full flex og la innholdet sentres naturlig
    return [...baseStyle, styles.centerOverlay];
  };

  return (
    <ModalContext.Provider value={{ showModal, hideModal, isModalOpen }}>
      {children}
     
      <Modal
        visible={isModalOpen}
        transparent={true}
        animationType={modalType === 'bottom' ? 'slide' : 'fade'}
        onRequestClose={hideModal}
        statusBarTranslucent={true}
      >
        <TouchableWithoutFeedback onPress={handleBackdropPress}>
          <View style={getOverlayStyle()}>
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
  },
  blurBackground: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  
  // Overlay for center modaler
  centerOverlay: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20, // Gi litt padding på sidene
  },
  
  centeredContent: {
    // La innholdet bestemme sin egen størrelse
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%', // Ta tilgjengelig bredde
    maxWidth: 500, // Men ikke mer enn dette
  },
  
  // Styles for bottom sheet (uendret)
  bottomOverlay: {
    justifyContent: 'flex-end',
    alignItems: 'stretch',
  },
  bottomContent: {
    width: '100%',
    justifyContent: 'flex-end',
  },
});