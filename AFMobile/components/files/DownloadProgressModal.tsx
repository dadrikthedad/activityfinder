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
  const progressBarWidth = width - 80; // 40px margin on each side

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

  const getProgressText = () => {
    if (totalBytes && downloadedBytes) {
      return `${formatBytes(downloadedBytes)} / ${formatBytes(totalBytes)}`;
    }
    return `${Math.round(progress * 100)}%`;
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Laster ned fil</Text>
            {onCancel && (
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={onCancel}
              >
                <Text style={styles.cancelText}>✕</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* File info */}
          <View style={styles.fileInfo}>
            <Text style={styles.fileName} numberOfLines={1}>
              {fileName}
            </Text>
            <Text style={styles.progressText}>
              {getProgressText()}
            </Text>
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

          {/* Percentage */}
          <Text style={styles.percentage}>
            {Math.round(progress * 100)}%
          </Text>

          {/* Status */}
          <Text style={styles.status}>
            {progress < 1 ? 'Laster ned...' : 'Fullført!'}
          </Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 24,
    margin: 20,
    minWidth: 280,
    maxWidth: '90%',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    flex: 1,
  },
  cancelButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: {
    fontSize: 16,
    color: '#6B7280',
    fontWeight: 'bold',
  },
  fileInfo: {
    width: '100%',
    marginBottom: 20,
  },
  fileName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 4,
    textAlign: 'center',
  },
  progressText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
  progressContainer: {
    alignItems: 'center',
    marginBottom: 12,
  },
  progressBackground: {
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#10B981',
    borderRadius: 4,
  },
  percentage: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 8,
  },
  status: {
    fontSize: 14,
    color: '#6B7280',
    fontStyle: 'italic',
  },
});