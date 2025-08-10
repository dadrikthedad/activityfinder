// ModalContext.tsx Brukes for å tilate at modaler kan poppe opp uansett hvor og når på skjermen. Brukes til å bekrefte å slette en venn både på en profilside samt i Friends siden. Brukes i layout.tsx
// AFMobile/context/ModalContext.tsx
// Brukes for å tilate at modaler kan poppe opp uansett hvor og når på skjermen.
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
  
  const isModalOpen = modalContent !== null;

  const showModal = (content: ReactNode, options?: { 
    blurBackground?: boolean; 
    position?: { x: number; y: number };
    dismissOnBackdrop?: boolean;
  }) => {
    setModalContent(content);
    setBlurBackground(options?.blurBackground !== false);
    setModalPosition(options?.position ?? null);
    setDismissOnBackdrop(options?.dismissOnBackdrop !== false);
  };

  const hideModal = () => {
    setModalContent(null);
    setModalPosition(null);
  };

  const handleBackdropPress = () => {
    if (dismissOnBackdrop) {
      hideModal();
    }
  };

  return (
    <ModalContext.Provider value={{ showModal, hideModal, isModalOpen }}>
      {children}
      
      <Modal
        visible={isModalOpen}
        transparent={true}
        animationType="fade"
        onRequestClose={hideModal}
        statusBarTranslucent={true}
      >
        <TouchableWithoutFeedback onPress={handleBackdropPress}>
          <View style={[
            styles.overlay,
            blurBackground && styles.blurBackground
          ]}>
            <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
              <View style={[
                modalPosition 
                  ? { 
                      position: 'absolute',
                      left: modalPosition.x,
                      top: modalPosition.y 
                    }
                  : styles.centeredContent
              ]}>
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
});