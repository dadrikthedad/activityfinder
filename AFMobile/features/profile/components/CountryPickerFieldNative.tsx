import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useUnistyles } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';
import { useModal } from '@/context/ModalContext';
import SearchableSelectModalNative from '@/components/common/modal/SearchableSelectModal';
import { fetchCountries } from '@/features/auth/services/signUpService';

interface Props {
  value: string; // ISO-kode, f.eks. "NO"
  onChange: (isoCode: string) => void;
}

export default function CountryPickerFieldNative({ value, onChange }: Props) {
  const { theme } = useUnistyles();
  const { t } = useTranslation();
  const { showModal, hideModal } = useModal();

  // options: { label: landnavn, value: ISO-kode }
  const [options, setOptions] = useState<{ label: string; value: string }[]>([]);

  useEffect(() => {
    fetchCountries().then((data) => {
      const sorted = data
        .map((c) => ({ label: c.name, value: c.code }))
        .sort((a, b) => a.label.localeCompare(b.label));
      setOptions(sorted);
    });
  }, []);

  const displayLabel = options.find((o) => o.value === value)?.label ?? value;

  const showPicker = () => {
    showModal(
      <SearchableSelectModalNative
        title={t('auth.selectCountryModal') ?? 'Select Country'}
        options={options}
        selectedValue={value}
        onSelect={(isoCode) => { onChange(isoCode); hideModal(); }}
        onClose={hideModal}
        placeholder={t('auth.searchCountries') ?? 'Search...'}
      />,
      { blurBackground: true, dismissOnBackdrop: true, type: 'center' }
    );
  };

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: theme.colors.textSecondary }]}>
        {t('profile.country')}
      </Text>
      <TouchableOpacity
        style={[styles.picker, { borderColor: theme.colors.border, backgroundColor: theme.colors.backgroundInput }]}
        onPress={showPicker}
      >
        <Text style={[styles.pickerText, { color: value ? theme.colors.textPrimary : theme.colors.textPlaceholder }]}>
          {value ? displayLabel : t('auth.selectCountry') ?? 'Select country'}
        </Text>
        <Ionicons name="chevron-down" size={20} color={theme.colors.textMuted} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 6,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 6,
  },
  picker: {
    height: 48,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pickerText: {
    fontSize: 15,
    flex: 1,
  },
});
