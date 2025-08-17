// hooks/useConfirmModal.ts - React Native version with custom styling
import { useCallback, useState } from "react";
import { ReactNode } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet
} from "react-native";
import { useModal } from "../context/ModalContext";

export type ConfirmOptions = {
  title?: string;
  message: ReactNode;
};

export function useConfirmModalNative() {
  const { showModal, hideModal } = useModal();
  const [resolvePromise, setResolvePromise] = useState<((result: boolean) => void) | null>(null);

  const confirm = useCallback(
    (options: ConfirmOptions) => {
      return new Promise<boolean>((resolve) => {
        setResolvePromise(() => resolve);
       
        const handleClose = (result: boolean) => {
          resolve(result);
          setResolvePromise(null);
          hideModal();
        };

        const dialogContent = (
          <View style={styles.dialog}>
            <Text style={styles.title}>
              {options.title || "Bekreft"}
            </Text>
           
            <View style={styles.messageContainer}>
              {typeof options.message === 'string' ? (
                <Text style={styles.message}>{options.message}</Text>
              ) : (
                options.message
              )}
            </View>
           
            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={[styles.button, styles.cancelButton]}
                onPress={() => handleClose(false)}
              >
                <Text style={styles.cancelButtonText}>Decline</Text>
              </TouchableOpacity>
             
              <TouchableOpacity
                style={[styles.button, styles.confirmButton]}
                onPress={() => handleClose(true)}
              >
                <Text style={styles.confirmButtonText}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        );

        showModal(dialogContent, {
          blurBackground: true,
          dismissOnBackdrop: false // Prevent accidental dismissal
        });
      });
    },
    [showModal, hideModal]
  );

  return { confirm };
}

const styles = StyleSheet.create({
  dialog: {
    backgroundColor: 'white', // Hvit bakgrunn som ønsket
    borderRadius: 12,
    padding: 24,
    maxWidth: 400,
    width: 300,
    borderWidth: 2, // Lagt til border
    borderColor: '#1C6B1C', // Lys grå border
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1C6B1C', // Mørkere tittel for bedre kontrast
    textAlign: 'center',
    marginBottom: 16,
  },
  messageContainer: {
    marginBottom: 24,
  },
  message: {
    fontSize: 16,
    color: '#374151',
    textAlign: 'center',
    lineHeight: 24,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#9CA3AF', // Din ønskede avbryt-farge
  },
  confirmButton: {
    backgroundColor: '#1C6B1C', // Din ønskede bekreft-farge
  },
  cancelButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
  },
  confirmButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
  },
});