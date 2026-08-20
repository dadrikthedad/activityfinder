import React from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useUnistyles } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';
import { useUserCacheStore } from '@/store/useUserCacheStore';
import ButtonNative from '@/components/common/buttons/ButtonNative';
import ProfileHeaderNative from '@/features/profile/components/ProfileHeaderNative';
import type { MyProfileScreenNavigationProp } from '@/types/navigation';

export default function MyProfileScreen() {
  const navigation = useNavigation<MyProfileScreenNavigationProp>();
  const { theme } = useUnistyles();
  const { t } = useTranslation();

  const currentUser = useUserCacheStore((s) => s.currentUser);
  const profile = useUserCacheStore((s) => s.profile);
  const settings = useUserCacheStore((s) => s.settings);

  return (
    <ScrollView style={{ backgroundColor: theme.colors.background }}>
      <View style={styles.content}>
        <ProfileHeaderNative
          fullName={currentUser?.fullName ?? ''}
          profileImageUrl={currentUser?.profileImageUrl ?? null}
          bio={profile?.bio}
          websites={settings?.showWebsites ? profile?.websites : null}
          age={settings?.showAge ? profile?.age : null}
          dateOfBirth={settings?.showBirthday ? profile?.dateOfBirth : null}
          countryCode={profile?.countryCode}
          contactEmail={settings?.showEmail ? profile?.contactEmail : null}
          contactPhone={settings?.showPhone ? profile?.contactPhone : null}
          isEditable
        />

        <View style={styles.actions}>
          <ButtonNative
            text={t('profile.editProfileTitle')}
            onPress={() => navigation.navigate('EditProfileScreen')}
            variant="primary"
            fullWidth
          />
          <ButtonNative
            text={t('profile.goToSettings')}
            onPress={() => navigation.navigate('ProfileSettingsScreen')}
            variant="outline"
            fullWidth
          />
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 24,
    gap: 12,
  },
  actions: {
    width: '100%',
    maxWidth: 400,
    gap: 12,
    marginTop: 8,
  },
});
