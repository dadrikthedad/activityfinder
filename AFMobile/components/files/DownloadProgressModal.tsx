// components/common/DownloadProgressModal.tsx
import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions
} from 'react-native';
import { X } from 'lucide-react-native';

interface DownloadProgressModalProps {
  visible: boolean;
  fileName: string;
  progress: number; // 0-1
  totalBytes?: number;
  downloadedBytes?: number;
  onCancel?: () => void;
}

const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
};

export default function DownloadProgressModal({
  visible,
  fileName,
  progress,
  totalBytes,
  downloadedBytes,
  onCancel
}: DownloadProgressModalProps) {
  const progressAnim = React.useRef(new Animated.Value(0)).current;
  const { width } = Dimensions.get('window');
  const progressBarWidth = 160; // Fixed smaller width

  React.useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: progress,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [progress]);

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, progressBarWidth],
    extrapolate: 'clamp',
  });

  const getBytesText = () => {
    if (totalBytes && downloadedBytes) {
      return `${formatBytes(downloadedBytes)} / ${formatBytes(totalBytes)}`;
    }
    return null;
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      // Add these props to ensure it's on top
      presentationStyle="overFullScreen"
      hardwareAccelerated={true}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header with close button */}
          <View style={styles.header}>
            {/* File name (compact) */}
            <Text style={styles.fileName} numberOfLines={1}>
              {fileName}
            </Text>
            
            {/* Close button */}
            {onCancel && (
              <TouchableOpacity
                style={styles.closeButton}
                onPress={onCancel}
              >
                <X size={16} color="#ffffffff" />
              </TouchableOpacity>
            )}
          </View>

          {/* Progress bar */}
          <View style={styles.progressContainer}>
            <View style={[styles.progressBackground, { width: progressBarWidth }]}>
              <Animated.View
                style={[
                  styles.progressFill,
                  { width: progressWidth }
                ]}
              />
            </View>
          </View>

          {/* Bytes info under progress bar */}
          {getBytesText() && (
            <Text style={styles.bytesText}>
              {getBytesText()}
            </Text>
          )}

          {/* Compact percentage */}
          <Text style={styles.percentage}>
            {Math.round(progress * 100)}%
          </Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    // Add high z-index to ensure it's on top
    zIndex: 9999,
    elevation: 9999, // For Android
  },
  container: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 16,
    margin: 20,
    minWidth: 200,
    maxWidth: 280,
    alignItems: 'center',
    borderWidth: 2, 
    borderColor: '#1C6B1C',
    // Add shadow/elevation for better visibility
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10, // For Android
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 12,
  },
  fileName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    flex: 1,
    marginRight: 8,
  },
  closeButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#1C6B1C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressContainer: {
    alignItems: 'center',
    marginBottom: 6,
  },
  progressBackground: {
    height: 6,
    backgroundColor: '#E5E7EB',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#1C6B1C',
    borderRadius: 3,
  },
  bytesText: {
    fontSize: 11,
    color: '#6B7280',
    marginBottom: 8,
    textAlign: 'center',
  },
  percentage: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
});