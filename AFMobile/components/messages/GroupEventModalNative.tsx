// components/notifications/GroupEventModalNative.tsx
import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
} from 'react-native';

interface GroupEventModalNativeProps {
  visible: boolean;
  eventSummaries: string[];
  groupName: string;
  eventCount: number;
  onClose: () => void;
}

export default function GroupEventModalNative({
  visible,
  eventSummaries,
  groupName,
  eventCount,
  onClose,
}: GroupEventModalNativeProps) {
  
  const renderEventItem = ({ item, index }: { item: string; index: number }) => (
    <View style={styles.eventItem}>
      <View style={styles.eventBullet} />
      <Text style={styles.eventText}>{item}</Text>
    </View>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>
              Recent Activities in {groupName}
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Content */}
          <View style={styles.content}>
            {eventSummaries.length === 0 ? (
              <Text style={styles.emptyText}>No recent activities</Text>
            ) : (
              <>
                <Text style={styles.subtitle}>
                  {eventCount} recent event{eventCount !== 1 ? 's' : ''}:
                </Text>
                
                <FlatList
                  data={eventSummaries}
                  renderItem={renderEventItem}
                  keyExtractor={(item, index) => index.toString()}
                  style={styles.eventsList}
                  showsVerticalScrollIndicator={false}
                />
              </>
            )}
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <TouchableOpacity onPress={onClose} style={styles.okButton}>
              <Text style={styles.okButtonText}>OK</Text>
            </TouchableOpacity>
          </View>
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
    paddingHorizontal: 20,
  },
  container: {
    backgroundColor: 'white',
    borderRadius: 12,
    maxWidth: 400,
    width: '100%',
    maxHeight: '70%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    flex: 1,
    marginRight: 16,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#6b7280',
  },
  content: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    flex: 1,
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 12,
  },
  eventsList: {
    flex: 1,
  },
  eventItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 6,
    gap: 10,
  },
  eventBullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#16a34a',
    marginTop: 6,
  },
  eventText: {
    flex: 1,
    fontSize: 13,
    color: '#374151',
    lineHeight: 18,
  },
  emptyText: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
    paddingVertical: 20,
  },
  footer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  okButton: {
    backgroundColor: '#1C6B1C',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
  },
  okButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});