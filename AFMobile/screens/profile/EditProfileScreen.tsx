import React from 'react';
import { View, Text, ScrollView, SafeAreaView, StatusBar, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { ArrowLeft } from 'lucide-react-native';
import { useUnistyles } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';
import { RootStackParamList } from '@/types/navigation';
import AppHeader from '@/components/common/AppHeader';
import SpinnerNative from '@/components/common/SpinnerNative';
import ButtonNative from '@/components/common/buttons/ButtonNative';
import FormFieldNative from '@/components/common/FormFieldNative';
import WebsiteListInputNative from '@/features/profile/components/WebsiteListInputNative';
import CountryPickerFieldNative from '@/features/profile/components/CountryPickerFieldNative';
import DatePickerNative from '@/components/common/DatePickerNative';
import { useProfileSettings } from '@/features/profile/hooks/useProfileSettings';
import { ProfileErrorCode } from '@/core/errors/ErrorCode';

export default function EditProfileScreen() {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const { theme } = useUnistyles();
  const { t } = useTranslation();

  const {
    profileForm,
    setProfileField,
    submitProfile,
    submitting,
    submitErrorCode,
    submitSuccess,
    profileLoading,
    profileErrorCode,
    refetchProfile,
  } = useProfileSettings();

  if (profileLoading) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.colors.background }]}>
        <SpinnerNative />
      </View>
    );
  }

  if (profileErrorCode) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.colors.background }]}>
        <Text style={[styles.errorText, { color: theme.colors.error }]}>
          {t('profile.loadErrorTitle')}
        </Text>
        <ButtonNative
          text={t('common.tryAgain') ?? 'Try Again'}
          onPress={refetchProfile}
          variant="primary"
        />
      </View>
    );
  }

  const errorMessage = submitErrorCode === ProfileErrorCode.NetworkError
    ? t('profile.networkErrorBody')
    : submitErrorCode === ProfileErrorCode.ValidationError
      ? t('profile.validationErrorBody')
      : submitErrorCode
        ? t('profile.serverErrorBody')
        : null;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <StatusBar backgroundColor={theme.colors.navbar} barStyle="light-content" />
      <AppHeader
        title={t('profile.editProfileTitle')}
        onBackPress={() => navigation.goBack()}
        backIcon={ArrowLeft}
      />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        <FormFieldNative
          id="bio"
          label={t('profile.bio')}
          value={profileForm.bio}
          onChangeText={(v) => setProfileField('bio', v)}
          multiline
          numberOfLines={4}
          maxLength={1000}
        />

        <FormFieldNative
          id="contactEmail"
          label={t('profile.contactEmail')}
          value={profileForm.contactEmail}
          onChangeText={(v) => setProfileField('contactEmail', v)}
          keyboardType="email-address"
          autoCapitalize="none"
        />

        <FormFieldNative
          id="contactPhone"
          label={t('profile.contactPhone')}
          value={profileForm.contactPhone}
          onChangeText={(v) => setProfileField('contactPhone', v)}
          keyboardType="phone-pad"
        />

        <CountryPickerFieldNative
          value={profileForm.countryCode}
          onChange={(v) => setProfileField('countryCode', v)}
        />

        <DatePickerNative
          id="dateOfBirth"
          label={t('profile.dateOfBirth')}
          value={profileForm.dateOfBirth}
          onChangeText={(v) => setProfileField('dateOfBirth', v)}
          maxDate={new Date()}
        />

        <WebsiteListInputNative
          websites={profileForm.websites}
          onChange={(v) => setProfileField('websites', v)}
        />

        {errorMessage && (
          <Text style={[styles.errorText, { color: theme.colors.error }]}>
            {errorMessage}
          </Text>
        )}

        {submitSuccess && (
          <Text style={[styles.successText, { color: theme.colors.success }]}>
            {t('profile.profileUpdatedTitle')}
          </Text>
        )}

        <View style={styles.buttons}>
          <ButtonNative
            text={submitting ? t('common.saving') ?? 'Saving...' : t('profile.saveChanges')}
            onPress={submitProfile}
            variant="primary"
            size="large"
            fullWidth
            loading={submitting}
            disabled={submitting}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingVertical: 24,
    gap: 16,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 16,
  },
  errorText: {
    fontSize: 14,
    textAlign: 'center',
  },
  successText: {
    fontSize: 14,
    textAlign: 'center',
    fontWeight: '600',
  },
  buttons: {
    gap: 12,
    marginTop: 8,
  },
});
