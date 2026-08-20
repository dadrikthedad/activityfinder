import React from 'react';
import { View, Text, TouchableOpacity, Linking, StyleSheet } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';
import { format, parseISO } from 'date-fns';
import ProfileAvatarNative from '@/features/profile/components/ProfileAvatarNative';
import { useCountryName } from '@/features/profile/hooks/useCountryName';

interface Props {
  fullName: string;
  profileImageUrl: string | null;
  bio?: string | null;
  websites?: string[] | null;
  age?: number | null;
  dateOfBirth?: string | null;
  countryCode?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  isEditable?: boolean;
}

const InfoRow = ({ label, value }: { label: string; value: string }) => {
  const { theme } = useUnistyles();
  return (
    <View style={styles.infoRow}>
      <Text style={[styles.label, { color: theme.colors.textMuted }]}>{label}</Text>
      <Text style={[styles.value, { color: theme.colors.textPrimary }]}>{value}</Text>
    </View>
  );
};

export default function ProfileHeaderNative({
  fullName,
  profileImageUrl,
  bio,
  websites,
  age,
  dateOfBirth,
  countryCode,
  contactEmail,
  contactPhone,
  isEditable = false,
}: Props) {
  const { theme } = useUnistyles();
  const { t } = useTranslation();
  const countryName = useCountryName(countryCode);

  const hasBasicInfo = age != null || dateOfBirth != null || countryCode || contactEmail || contactPhone;
  const hasWebsites = websites && websites.length > 0;

  const handleWebsitePress = async (url: string) => {
    const supported = await Linking.canOpenURL(url);
    if (supported) await Linking.openURL(url);
  };

  return (
    <View style={styles.container}>
      <ProfileAvatarNative imageUrl={profileImageUrl ?? ''} isEditable={isEditable} />

      <Text style={[styles.name, { color: theme.colors.textPrimary }]}>
        {fullName}
      </Text>

      {/* Bio */}
      {(bio || isEditable) && (
        <View style={[styles.card, { backgroundColor: theme.colors.backgroundAlt, borderColor: theme.colors.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>
            {t('profile.bio')}
          </Text>
          <Text style={[styles.bio, { color: bio ? theme.colors.textPrimary : theme.colors.textMuted, fontStyle: bio ? 'normal' : 'italic' }]}>
            {bio ?? t('profile.bioPlaceholder') ?? 'No bio added yet.'}
          </Text>
        </View>
      )}

      {/* Grunnleggende info */}
      {hasBasicInfo && (
        <View style={[styles.card, { backgroundColor: theme.colors.backgroundAlt, borderColor: theme.colors.border }]}>
          {age != null && <InfoRow label={t('profile.age')} value={String(age)} />}
          {dateOfBirth != null && <InfoRow label={t('profile.dateOfBirth')} value={format(parseISO(dateOfBirth), 'dd.MM.yyyy')} />}
          {countryCode ? <InfoRow label={t('profile.country')} value={countryName} /> : null}
          {contactEmail ? <InfoRow label={t('profile.contactEmail')} value={contactEmail} /> : null}
          {contactPhone ? <InfoRow label={t('profile.contactPhone')} value={contactPhone} /> : null}
        </View>
      )}

      {/* Nettsteder */}
      {hasWebsites && (
        <View style={[styles.card, { backgroundColor: theme.colors.backgroundAlt, borderColor: theme.colors.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>
            {t('profile.websites')}
          </Text>
          {websites!.map((url) => (
            <TouchableOpacity key={url} onPress={() => handleWebsitePress(url)} style={styles.websiteItem}>
              <Text style={[styles.websiteLink, { color: theme.colors.primary }]} numberOfLines={1}>
                {url}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: 12,
    width: '100%',
  },
  name: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginTop: 8,
  },
  bio: {
    fontSize: 15,
    lineHeight: 22,
  },
  card: {
    width: '100%',
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
  },
  value: {
    fontSize: 14,
    flexShrink: 1,
    textAlign: 'right',
  },
  websiteItem: {
    paddingVertical: 2,
  },
  websiteLink: {
    fontSize: 14,
    textDecorationLine: 'underline',
  },
});
