import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { UserX } from 'lucide-react-native';
import { UserSummaryDTO } from '@shared/types/UserSummaryDTO';
import { useUnblockUser } from '@/hooks/block/useUnblockUser';
import { useConfirmModalNative } from '@/hooks/useConfirmModalNative';
import ClickableAvatarNative from '@/components/common/ClickableAvatarNative';
import SearchInput from './SearchInput';
import { showNotificationToastNative, LocalToastType } from '../toast/NotificationToastNative';

interface BlockedUsersSectionProps {
  blockedUsers: UserSummaryDTO[];
  navigation: any;
  onError: (message: string) => void;
}

export default function BlockedUsersSection({
  blockedUsers,
  navigation,
  onError,
}: BlockedUsersSectionProps) {
  const [searchText, setSearchText] = useState('');
  const { unblockUser, isLoading: isUnblocking } = useUnblockUser();
  const { confirm } = useConfirmModalNative();

  // Filter blocked users based on search
  const filteredUsers = useMemo(() => {
    if (!searchText.trim()) return blockedUsers;
    const searchLower = searchText.toLowerCase();
    return blockedUsers.filter(user => 
      user.fullName.toLowerCase().includes(searchLower)
    );
  }, [blockedUsers, searchText]);

  const handleUnblockUser = useCallback(async (userId: number, userName: string) => {
    const confirmed = await confirm({
      title: 'Unblock User',
      message: `Are you sure you want to unblock ${userName}? They will be able to contact you again.`
    });

    if (confirmed) {
      try {
        const result = await unblockUser(userId);
        
        if (result) {
          showNotificationToastNative({
            type: LocalToastType.CustomSystemNotice,
            customTitle: "User Unblocked",
            customBody: `${userName} can now contact you again`,
            position: 'top'
          });
        }
      } catch (error) {
        console.error('❌ Could not unblock user:', error);
        onError('Could not unblock user');
      }
    }
  }, [confirm, unblockUser, onError]);

  const renderBlockedUserItem = useCallback((user: UserSummaryDTO) => {
    return (
      <View key={user.id} style={styles.blockedUserContainer}>
        <View style={styles.blockedUserContent}>
          <ClickableAvatarNative
            user={user}
            size={60}
            navigation={navigation}
          />
          
          <View style={styles.blockedUserInfo}>
            <View style={styles.blockedUserNameContainer}>
              <Text style={styles.blockedUserName}>{user.fullName}</Text>
              <View style={styles.blockedBadge}>
                <Text style={styles.blockedBadgeText}>BLOCKED</Text>
              </View>
            </View>
            <Text style={styles.blockedUserSubtitle}>
              This user is blocked and cannot contact you
            </Text>
          </View>
        </View>
        
        {/* Unblock button */}
        <View style={styles.actionButtons}>
          <TouchableOpacity
            onPress={() => handleUnblockUser(user.id, user.fullName)}
            disabled={isUnblocking}
            style={[styles.button, styles.unblockButton]}
          >
            {isUnblocking ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <>
                <UserX size={16} color="white" />
                <Text style={styles.buttonText}>Unblock</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  }, [navigation, handleUnblockUser, isUnblocking]);

  if (blockedUsers.length === 0) {
    return null;
  }

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>
        Blocked Users ({blockedUsers.length})
      </Text>
      <Text style={styles.sectionSubtitle}>
        Users you have blocked cannot contact you
      </Text>
      
      <SearchInput
        value={searchText}
        onChangeText={setSearchText}
        placeholder="Search blocked users..."
      />
      
      {filteredUsers.length === 0 && searchText.trim() ? (
        <Text style={styles.noResultsText}>
          No blocked users match "{searchText}"
        </Text>
      ) : (
        <View style={styles.scrollableContainer}>
          <ScrollView 
            style={styles.scrollView}
            showsVerticalScrollIndicator={true}
            nestedScrollEnabled={true}
          >
            {filteredUsers.map((user) => renderBlockedUserItem(user))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 16,
    textAlign: 'center',
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 16,
  },
  blockedUserContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
  },
  blockedUserContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 12,
  },
  blockedUserInfo: {
    flex: 1,
  },
  blockedUserNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  blockedUserName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  blockedBadge: {
    backgroundColor: '#9CA3AF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  blockedBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  blockedUserSubtitle: {
    fontSize: 13,
    color: '#6B7280',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#F9FAFB',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    flex: 1,
    justifyContent: 'center',
  },
  unblockButton: {
    backgroundColor: '#6B7280',
  },
  buttonText: {
    color: 'white',
    fontWeight: '500',
    fontSize: 14,
    marginLeft: 6,
  },
  noResultsText: {
    fontSize: 14,
    color: '#9CA3AF',
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 24,
  },
  // ✅ Scrollable container styles
  scrollableContainer: {
    maxHeight: 500, // Increased height to show more content
    minHeight: 200, // Minimum height to ensure content is visible
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
  },
});