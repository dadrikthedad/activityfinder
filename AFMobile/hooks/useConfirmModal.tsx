// hooks/useConfirmDialog.ts - React Native version with ModalContext
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

export function useConfirmModal() {
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
              {options.title || "Confirm"}
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
                <Text style={styles.cancelButtonText}>Cancel</Text>
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
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 24,
    maxWidth: 400,
    width: 300,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1C6B1C',
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
    justifyContent: 'center',
    gap: 16,
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    minWidth: 80,
  },
  cancelButton: {
    backgroundColor: '#6B7280',
  },
  confirmButton: {
    backgroundColor: '#1C6B1C',
  },
  cancelButtonText: {
    color: 'white',
    fontWeight: '600',
    textAlign: 'center',
  },
  confirmButtonText: {
    color: 'white',
    fontWeight: '600',
    textAlign: 'center',
  },
});