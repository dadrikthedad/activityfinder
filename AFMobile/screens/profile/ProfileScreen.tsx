import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';import { useRoute, useNavigation } from '@react-navigation/native';
import { useUnistyles } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/context/AuthContext';
import { useIsUserBlockedByGuid } from '@/store/useUserCacheStore';
import { ProfileScreenRouteProp, RootStackParamList } from '@/types/navigation';
import { StackNavigationProp } from '@react-navigation/stack';
import SpinnerNative from '@/components/common/SpinnerNative';
import ButtonNative from '@/components/common/buttons/ButtonNative';
import ProfileActionMenuNative from '@/components/profile/ProfileActionMenuNative';
import { useUnblockUser } from '@/features/blocking/hooks/useUnblockUser';
import { showNotificationToastNative, LocalToastType } from '@/components/toast/NotificationToastNative';
import { getPublicProfile } from '@/features/profile/services/profileService';
import { ProfileErrorCode } from '@/core/errors/ErrorCode';
import ProfileHeaderNative from '@/features/profile/components/ProfileHeaderNative';
import type { PublicProfileResponseDTO } from '@/features/profile/models/PublicProfileResponseDTO';
import type { UserSearchResultDTO } from '@/features/messages/models/UserSearchResultDTO';

export default function ProfileScreen() {
  const route = useRoute<ProfileScreenRouteProp>();
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const { theme } = useUnistyles();
  const { t } = useTranslation();

  const { id } = route.params;
  const { userId: currentUserId } = useAuth();
  const isBlockedByMe = useIsUserBlockedByGuid(id);
  const { unblockUser, isLoading: isUnblocking } = useUnblockUser();

  const [profile, setProfile] = useState<PublicProfileResponseDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorCode, setErrorCode] = useState<ProfileErrorCode | null>(null);

  // Redirect til egen profil-skjerm hvis vi er eieren
  useEffect(() => {
    if (currentUserId === id) {
      navigation.replace('MyProfile');
    }
  }, [currentUserId, id, navigation]);

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    setErrorCode(null);
    const result = await getPublicProfile(id);
    if (!result.success) {
      setErrorCode(result.code);
    } else {
      setProfile(result.data);
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    if (currentUserId !== id) fetchProfile();
  }, [fetchProfile, currentUserId, id]);

  const handleSendMessage = () => {
    if (!profile) return;
    const receiver: UserSearchResultDTO = {
      id,
      fullName: profile.fullName,
      profileImageUrl: profile.profileImageUrl ?? null,
    };
    navigation.navigate('NewMessageScreen', { initialReceiver: receiver });
  };

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.colors.background }]}>
        <SpinnerNative />
      </View>
    );
  }

  if (errorCode || !profile) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.colors.background }]}>
        <Text style={[styles.errorText, { color: theme.colors.error }]}>
          {t('profile.loadErrorTitle')}
        </Text>
        <ButtonNative
          text={t('common.tryAgain') ?? 'Try Again'}
          onPress={fetchProfile}
          variant="primary"
        />
      </View>
    );
  }

  if (isBlockedByMe) {
    const handleUnblock = async () => {
      const result = await unblockUser(id);
      if (result.success) {
        showNotificationToastNative({
          type: LocalToastType.CustomSystemNotice,
          customTitle: t('profile.unblockedTitle'),
          customBody: t('profile.unblockedBody'),
          position: 'top',
        });
      }
    };

    const handleReport = () => {
      navigation.navigate('ReportUserScreen', {
        reportedUserId: id,
        reportedUserName: profile.fullName ?? undefined,
      });
    };

    return (
      <ScrollView style={{ backgroundColor: theme.colors.background }}>
        <View style={styles.content}>
          <ProfileHeaderNative
            fullName={profile.fullName}
            profileImageUrl={profile.profileImageUrl}
            bio={null}
          />
          <View style={[styles.privateBox, { backgroundColor: theme.colors.backgroundAlt, borderColor: theme.colors.border }]}>
            <Text style={[styles.privateTitle, { color: theme.colors.textSecondary }]}>
              {t('profile.blockedProfileMessage')}
            </Text>
          </View>
          <View style={styles.actions}>
            <ButtonNative
              text={t('profile.unblockUser')}
              onPress={handleUnblock}
              variant="muted"
              fullWidth
              loading={isUnblocking}
            />
            <ButtonNative
              text={t('profile.reportUser')}
              onPress={handleReport}
              variant="muted"
              fullWidth
            />
          </View>
        </View>
      </ScrollView>
    );
  }

  if (profile.isPrivate) {
    return (
      <ScrollView style={{ backgroundColor: theme.colors.background }}>
        <View style={styles.content}>
          <ProfileHeaderNative
            fullName={profile.fullName}
            profileImageUrl={profile.profileImageUrl}
            bio={null}
          />
          <View style={[styles.privateBox, { backgroundColor: theme.colors.backgroundAlt, borderColor: theme.colors.border }]}>
            <Text style={[styles.privateTitle, { color: theme.colors.textSecondary }]}>
              {t('profile.privateProfile')}
            </Text>
          </View>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={{ backgroundColor: theme.colors.background }}>
      <View style={styles.content}>
        <ProfileHeaderNative
          fullName={profile.fullName}
          profileImageUrl={profile.profileImageUrl}
          bio={profile.bio}
          websites={profile.websites}
          age={profile.age}
          dateOfBirth={profile.dateOfBirth}
          countryCode={profile.countryCode}
          contactEmail={profile.contactEmail}
          contactPhone={profile.contactPhone}
        />

        <View style={styles.actions}>
          <ButtonNative
            text={t('messages.sendMessage') ?? 'Send Message'}
            onPress={handleSendMessage}
            variant="primary"
            fullWidth
          />
          <ProfileActionMenuNative userId={id} userName={profile.fullName} />
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 16,
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 24,
    gap: 12,
  },
  actions: {
    width: '60%',
    alignSelf: 'center',
    gap: 12,
    marginTop: 8,
  },
errorText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 8,
  },
  privateBox: {
    marginTop: 24,
    padding: 24,
    borderRadius: 12,
    borderWidth: 1,
    width: '100%',
    alignItems: 'center',
  },
  privateTitle: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
});
