// components/common/modal/SearchableSelectModalNative.tsx
// Searchable Select Modal Component - extracted from EditableCountryRegionGroupNative
import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  TextInput,
} from "react-native";
import CloseButtonNative from "../buttons/CloseButtonNative";

interface SearchableSelectModalNativeProps {
  title: string;
  options: { label: string; value: string }[];
  selectedValue: string;
  onSelect: (value: string) => void;
  onClose: () => void;
  placeholder?: string;
}

export default function SearchableSelectModalNative({
  title,
  options,
  selectedValue,
  onSelect,
  onClose,
  placeholder = "Search...",
}: SearchableSelectModalNativeProps) {
  const [searchText, setSearchText] = useState("");

  const filteredOptions = options.filter(option =>
    option.label.toLowerCase().includes(searchText.toLowerCase())
  );

  const handleSelect = (value: string) => {
    // Only call onSelect if user actually selected a different value
    if (value !== selectedValue) {
      onClose();
      setTimeout(() => {
        onSelect(value);
      }, 100);
    } else {
      // Just close if same value selected
      onClose();
    }
  };

  return (
    <View style={styles.modalContainer}>
      <SafeAreaView style={styles.modalContent}>
        {/* Header */}
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>{title}</Text>
          <CloseButtonNative 
            onPress={onClose}
            theme="light"
            size={32}
            iconSize={16}
          />
        </View>

        {/* Search Input */}
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder={placeholder}
            value={searchText}
            onChangeText={setSearchText}
            autoCapitalize="none"
            autoCorrect={false}
            clearButtonMode="while-editing"
            autoFocus={true}
          />
        </View>

        {/* Options List */}
        <ScrollView 
          style={styles.optionsList}
          showsVerticalScrollIndicator={true}
          keyboardShouldPersistTaps="handled"
        >
          {filteredOptions.length > 0 ? (
            filteredOptions.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.optionItem,
                  selectedValue === option.value && styles.optionItemSelected
                ]}
                onPress={() => handleSelect(option.value)}
              >
                <Text style={[
                  styles.optionText,
                  selectedValue === option.value && styles.optionTextSelected
                ]}>
                  {option.label}
                </Text>
                {selectedValue === option.value && (
                  <Text style={styles.optionCheckmark}>✓</Text>
                )}
              </TouchableOpacity>
            ))
          ) : (
            <View style={styles.noResultsContainer}>
              <Text style={styles.noResultsText}>No results found</Text>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  // Modal styles
  modalContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    minHeight: 500,
    maxHeight: '85%',
    width: '90%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  
  modalContent: {
    flex: 1,
  },
  
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },

  // Search input styles
  searchContainer: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },

  searchInput: {
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    color: '#111827',
  },
  
  optionsList: {
    flex: 1,
  },
  
  optionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    minHeight: 56,
  },
  
  optionItemSelected: {
    backgroundColor: '#f0f9ff',
  },
  
  optionText: {
    fontSize: 16,
    color: '#111827',
    flex: 1,
  },
  
  optionTextSelected: {
    color: '#1C6B1C',
    fontWeight: '600',
  },
  
  optionCheckmark: {
    fontSize: 18,
    color: '#1C6B1C',
    fontWeight: 'bold',
  },

  // No results state
  noResultsContainer: {
    padding: 32,
    alignItems: 'center',
  },

  noResultsText: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
  },
});