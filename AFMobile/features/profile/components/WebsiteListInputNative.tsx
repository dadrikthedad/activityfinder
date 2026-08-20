import React, { useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';
import { PlusCircle, Trash2 } from 'lucide-react-native';

interface Props {
  websites: string[];
  onChange: (websites: string[]) => void;
}

export default function WebsiteListInputNative({ websites, onChange }: Props) {
  const { theme } = useUnistyles();
  const { t } = useTranslation();
  const lastInputRef = useRef<TextInput | null>(null);

  const addField = () => {
    onChange([...websites, '']);
    setTimeout(() => lastInputRef.current?.focus(), 100);
  };

  const removeField = (index: number) => {
    onChange(websites.filter((_, i) => i !== index));
  };

  const updateField = (index: number, value: string) => {
    const updated = [...websites];
    updated[index] = value;
    onChange(updated);
  };

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: theme.colors.textSecondary }]}>
        {t('profile.websites')}
      </Text>

      {websites.length === 0 ? (
        <TouchableOpacity
          onPress={addField}
          style={[styles.addFirstButton, { borderColor: theme.colors.border }]}
        >
          <PlusCircle size={16} color={theme.colors.primary} />
          <Text style={[styles.addFirstText, { color: theme.colors.primary }]}>
            {t('profile.websites')}
          </Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.list}>
          {websites.map((url, idx) => (
            <View key={idx} style={[styles.row, { borderColor: theme.colors.border, backgroundColor: theme.colors.backgroundInput }]}>
              <TextInput
                ref={idx === websites.length - 1 ? lastInputRef : null}
                style={[styles.input, { color: theme.colors.textPrimary }]}
                value={url}
                onChangeText={(v) => updateField(idx, v)}
                placeholder="https://example.com"
                placeholderTextColor={theme.colors.textPlaceholder}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
              />
              {idx === websites.length - 1 && (
                <TouchableOpacity onPress={addField} style={styles.iconButton}>
                  <PlusCircle size={20} color={theme.colors.primary} />
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={() => removeField(idx)} style={styles.iconButton}>
                <Trash2 size={20} color={theme.colors.textMuted} />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 2,
  },
  addFirstButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 8,
    padding: 12,
  },
  addFirstText: {
    fontSize: 14,
  },
  list: {
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    minHeight: 48,
  },
  input: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 10,
  },
  iconButton: {
    padding: 6,
  },
});
