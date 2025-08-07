// components/messages/ReplyPreviewNative.tsx
import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { MessageDTO } from '@shared/types/MessageDTO';

interface ReplyPreviewNativeProps {
  message: MessageDTO;
  onClear: () => void;
}

export const ReplyPreviewNative: React.FC<ReplyPreviewNativeProps> = ({ 
  message, 
  onClear 
}) => {
  const hasText = message.text && message.text.trim().length > 0;
  const hasAttachments = message.attachments && message.attachments.length > 0;
  
  // Get preview content
  const getPreviewContent = () => {
    if (hasText) {
      return message.text!.length > 100 
        ? `${message.text!.substring(0, 100)}...`
        : message.text!;
    } else if (hasAttachments) {
      const count = message.attachments!.length;
      return `${count} attachment${count !== 1 ? 's' : ''}`;
    } else {
      return "Message";
    }
  };

  // Get attachment info for display
  const getAttachmentInfo = () => {
    if (!hasAttachments) return null;
    if (hasText && message.text!.length >= 50) return null;
    
    const firstAttachment = message.attachments![0];
    const fileName = firstAttachment.fileName || 'File';
    const additionalCount = message.attachments!.length - 1;
    
    return {
      fileName,
      hasMore: additionalCount > 0,
      moreCount: additionalCount
    };
  };

  const attachmentInfo = getAttachmentInfo();

  return (
    <View style={styles.container}>
      {/* Header with reply icon, sender name, and close button */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          {/* Reply icon (simple arrow) */}
          <Text style={styles.replyIcon}>↩️</Text>
          
          <Text style={styles.replyLabel}>
            Replying to {message.sender?.fullName || "Unknown"}
          </Text>
        </View>
        
        <TouchableOpacity 
          onPress={onClear}
          style={styles.closeButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={styles.closeButtonText}>✕</Text>
        </TouchableOpacity>
      </View>
      
      {/* Message preview */}
      <Text style={styles.messagePreview} numberOfLines={2}>
        {getPreviewContent()}
      </Text>
      
      {/* Attachment info */}
      {attachmentInfo && (
        <View style={styles.attachmentInfo}>
          <Text style={styles.attachmentIcon}>📎</Text>
          <Text style={styles.attachmentText} numberOfLines={1}>
            {attachmentInfo.fileName}
            {attachmentInfo.hasMore && ` +${attachmentInfo.moreCount} more`}
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#1C6B1C',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 8,
  },
  replyIcon: {
    fontSize: 14,
  },
  replyLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    flex: 1,
  },
  closeButton: {
    padding: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(107, 114, 128, 0.1)',
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: 'bold',
    lineHeight: 14,
  },
  messagePreview: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 18,
  },
  attachmentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 6,
  },
  attachmentIcon: {
    fontSize: 12,
  },
  attachmentText: {
    fontSize: 12,
    color: '#9CA3AF',
    flex: 1,
  },
});