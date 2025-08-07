// components/messages/ConversationListItemNative.tsx
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { UserSummaryDTO } from '@shared/types/UserSummaryDTO';
import { useChatStore } from '@/store/useChatStore';
import ClickableAvatarNative from '../common/UserActionPopover/ClickableAvatarNative';

interface ConversationListItemNativeProps {
  user: UserSummaryDTO;
  selected?: boolean;
  onClick?: () => void;
  subtitle?: string;
  isClickable?: boolean;
  isPendingApproval?: boolean;
  hasUnread?: boolean;
  isGroup?: boolean;
  memberCount?: number;
  participants?: UserSummaryDTO[];
}

export const ConversationListItemNative = ({
  user,
  selected = false,
  onClick,
  subtitle,
  isClickable = true,
  isPendingApproval = false,
  hasUnread = false,
  isGroup = false,
  memberCount,
  participants,
}: ConversationListItemNativeProps) => {
  const conversations = useChatStore((s) => s.conversations);
  const conversation = isGroup ? conversations.find(c => c.id === user.id) : null;
  const storeParticipants = conversation?.participants || [];
  
  // ✅ PRIORITER: Bruk eksplisitt participants hvis gitt, ellers fall tilbake til store
  const finalParticipants = participants || storeParticipants;
  
  const getItemStyle = () => {
    if (selected) {
      return [styles.conversationItem, styles.selectedItem];
    }
    if (isPendingApproval) {
      return [styles.conversationItem, styles.pendingItem];
    }
    return styles.conversationItem;
  };

  return (
    <TouchableOpacity
      style={getItemStyle()}
      onPress={onClick}
      disabled={!isClickable}
    >
      {/* Avatar using ClickableAvatarNative */}
      <View style={styles.avatarContainer}>
        <ClickableAvatarNative
          user={user}
          size={40}
          isGroup={isGroup}
          participants={finalParticipants}
          isPendingRequest={isPendingApproval}
          conversationId={typeof user.id === 'number' ? user.id : undefined}
        />
        
        {/* Unread indicator */}
        {hasUnread && (
          <View style={styles.unreadDot} />
        )}
      </View>

      {/* Content */}
      <View style={styles.conversationContent}>
        <View style={styles.nameContainer}>
          <Text style={styles.conversationName} numberOfLines={1}>
            {user.fullName}
          </Text>
        </View>
        
        {/* Subtitle: memberCount for groups, or custom subtitle */}
        {isGroup && memberCount ? (
          <Text style={styles.subtitle} numberOfLines={1}>
            {memberCount} medlemmer
          </Text>
        ) : subtitle ? (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  conversationItem: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    paddingVertical: 8,
    marginHorizontal: 8,
    marginVertical: 4,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  selectedItem: {
    backgroundColor: '#e0f2e0',
    borderColor: '#166016',
    borderWidth: 2,
  },
  pendingItem: {
    borderColor: '#FDE047',
    borderWidth: 2,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  unreadDot: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 8,
    height: 8,
    backgroundColor: '#16A34A',
    borderRadius: 4,
  },
  conversationContent: {
    flex: 1,
    minWidth: 0,
  },
  nameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  conversationName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
  },
  subtitle: {
    fontSize: 12,
    color: '#6B7280',
  },
});