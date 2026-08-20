import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native';
import { UserX } from 'lucide-react-native';
import { useUnistyles } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';
import { BlockedUserDTO } from '@shared/types/BlockedUserDTO';
import { useUnblockUser } from '@/features/blocking/hooks/useUnblockUser';
import { useConfirmModalNative } from '@/hooks/useConfirmModalNative';
import ProfileAvatarNative from '@/features/profile/components/ProfileAvatarNative';
import SearchInput from './SearchInput';
import { showNotificationToastNative, LocalToastType } from '../toast/NotificationToastNative';
import { BlockingErrorCode } from '@/core/errors/ErrorCode';

interface BlockedUsersSectionProps {
  blockedUsers: BlockedUserDTO[];
  navigation: any;
  onError: (message: string) => void;
}

export default function BlockedUsersSection({ blockedUsers, navigation, onError }: BlockedUsersSectionProps) {
  const { theme } = useUnistyles();
  const { t } = useTranslation();
  const [searchText, setSearchText] = useState('');
  const { unblockUser, isLoading: isUnblocking } = useUnblockUser();
  const { confirm } = useConfirmModalNative();

  const filteredUsers = useMemo(() => {
    if (!searchText.trim()) return blockedUsers;
    const searchLower = searchText.toLowerCase();
    return blockedUsers.filter(user => user.fullName.toLowerCase().includes(searchLower));
  }, [blockedUsers, searchText]);

  const handleUnblockUser = useCallback(async (userId: string, userName: string) => {
    const confirmed = await confirm({
      title: t("profile.unblockConfirmTitle"),
      message: t("profile.unblockConfirmMessage"),
    });
    if (!confirmed) return;

    const result = await unblockUser(userId);
    if (result.success) {
      showNotificationToastNative({
        type: LocalToastType.CustomSystemNotice,
        customTitle: t("profile.unblockedTitle"),
        customBody: t("profile.unblockedBody"),
        position: 'top',
      });
    } else if (result.code === BlockingErrorCode.AlreadyBlocked) {
      showNotificationToastNative({
        type: LocalToastType.CustomSystemNotice,
        customTitle: t("profile.unblockErrorTitle"),
        customBody: t("profile.notBlockedBody"),
        position: 'top',
      });
    } else {
      onError(result.error ?? t("profile.unblockErrorTitle"));
    }
  }, [confirm, unblockUser, onError, t]);

  if (blockedUsers.length === 0) return null;

  return (
    <View style={{ marginBottom: theme.spacing.xl }}>
      <Text style={{
        fontSize: theme.typography.lg,
        fontWeight: theme.typography.semibold,
        color: theme.colors.textPrimary,
        marginBottom: theme.spacing.xs,
        textAlign: 'center',
      }}>
        {t("profile.blockedUsersTitle")} ({blockedUsers.length})
      </Text>
      <Text style={{
        fontSize: theme.typography.sm,
        color: theme.colors.textMuted,
        textAlign: 'center',
        marginBottom: theme.spacing.md,
      }}>
        {t("profile.blockedUsersSubtitle")}
      </Text>

      <SearchInput
        value={searchText}
        onChangeText={setSearchText}
        placeholder={t("profile.searchBlockedUsers")}
      />

      {filteredUsers.length === 0 && searchText.trim() ? (
        <Text style={{
          fontSize: theme.typography.sm,
          color: theme.colors.textMuted,
          fontStyle: 'italic',
          textAlign: 'center',
          paddingVertical: theme.spacing.lg,
        }}>
          {t("profile.noBlockedUsersMatch", { search: searchText })}
        </Text>
      ) : (
        <View style={{
          maxHeight: 500,
          borderRadius: theme.radii.md,
          borderWidth: 1,
          borderColor: theme.colors.border,
          backgroundColor: theme.colors.surface,
          overflow: 'hidden',
        }}>
          <ScrollView showsVerticalScrollIndicator nestedScrollEnabled>
            {filteredUsers.map(user => (
              <View
                key={user.userId}
                style={{
                  borderBottomWidth: 1,
                  borderBottomColor: theme.colors.border,
                }}
              >
                <View style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingHorizontal: theme.spacing.md,
                  paddingVertical: theme.spacing.md,
                  gap: theme.spacing.sm,
                }}>
                  <ProfileAvatarNative
                    imageUrl={user.profileImageUrl ?? ''}
                    isEditable={false}
                  />

                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs, marginBottom: 4 }}>
                      <Text style={{
                        fontSize: theme.typography.md,
                        fontWeight: theme.typography.semibold,
                        color: theme.colors.textPrimary,
                      }}>
                        {user.fullName}
                      </Text>
                      <View style={{
                        backgroundColor: theme.colors.backgroundAlt,
                        paddingHorizontal: 6,
                        paddingVertical: 2,
                        borderRadius: theme.radii.sm,
                        borderWidth: 1,
                        borderColor: theme.colors.border,
                      }}>
                        <Text style={{
                          color: theme.colors.textMuted,
                          fontSize: 10,
                          fontWeight: theme.typography.bold,
                          letterSpacing: 0.5,
                        }}>
                          {t("profile.blockedBadge")}
                        </Text>
                      </View>
                    </View>
                    <Text style={{ fontSize: theme.typography.xs, color: theme.colors.textMuted }}>
                      {t("profile.blockedUserSubtitle")}
                    </Text>
                  </View>
                </View>

                <View style={{
                  paddingHorizontal: theme.spacing.md,
                  paddingVertical: theme.spacing.sm,
                  backgroundColor: theme.colors.backgroundAlt,
                }}>
                  <TouchableOpacity
                    onPress={() => handleUnblockUser(user.userId, user.fullName)}
                    disabled={isUnblocking}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      paddingVertical: theme.spacing.sm,
                      paddingHorizontal: theme.spacing.md,
                      borderRadius: theme.radii.md,
                      backgroundColor: theme.colors.surface,
                      borderWidth: 1,
                      borderColor: theme.colors.border,
                      gap: theme.spacing.xs,
                    }}
                  >
                    {isUnblocking ? (
                      <ActivityIndicator size="small" color={theme.colors.textSecondary} />
                    ) : (
                      <>
                        <UserX size={16} color={theme.colors.textSecondary} />
                        <Text style={{
                          color: theme.colors.textSecondary,
                          fontWeight: theme.typography.medium,
                          fontSize: theme.typography.sm,
                        }}>
                          {t("profile.unblockUser")}
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}
