import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  SafeAreaView,
  Dimensions,
} from "react-native";
import { validateSingleField } from "@shared/utils/validators";
import ButtonNative from "../common/buttons/ButtonNative";
import CloseButtonNative from "../common/buttons/CloseButtonNative";
import { showNotificationToastNative } from "../toast/NotificationToastNative";
import { LocalToastType } from "../toast/NotificationToastNative";

interface EditableCountryRegionGroupProps {
  country: string;
  region: string;
  countries: { label: string; value: string }[];
  regions: { label: string; value: string }[];
  onTempCountryChange: (val: string) => void;
  onTempRegionChange: (val: string) => void;
  onSave: (country: string, region: string) => Promise<void>;
  onEditStart: (country: string) => Promise<void>;
  onCancel: () => void;
}

const { height: screenHeight } = Dimensions.get('window');

export default function EditableCountryRegionGroupNative({
  country,
  region,
  countries,
  regions,
  onTempCountryChange,
  onTempRegionChange,
  onSave,
  onEditStart,
  onCancel,
}: EditableCountryRegionGroupProps) {
  const [editing, setEditing] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState(country);
  const [selectedRegion, setSelectedRegion] = useState(region);
  const [saved, setSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [showRegionPicker, setShowRegionPicker] = useState(false);

  const handleCancel = () => {
    setSelectedCountry(country);
    setSelectedRegion(region);
    setEditing(false);
    setError(null);
    setShowCountryPicker(false);
    setShowRegionPicker(false);
    onCancel();
  };

  const handleSave = async () => {
    const countryError = validateSingleField("country", selectedCountry);
    const isRegionValid = regions.some((opt) => opt.value === selectedRegion);

    const regionError =
      selectedRegion === "" ||
      selectedRegion === "-- Choose --" ||
      !isRegionValid
        ? "Please select a valid region."
        : validateSingleField("region", selectedRegion);

    if (countryError || regionError) {
      const errorMessage = countryError || regionError || "Validation error";
      setError(errorMessage);
      showNotificationToastNative({
        type: LocalToastType.CustomSystemNotice,
        customTitle: "Validation Error",
        customBody: errorMessage,
        position: 'top'
      });
      return;
    }

    setIsSaving(true);
    try {
      await onSave(selectedCountry, selectedRegion);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      setEditing(false);
      setError(null);
      showNotificationToastNative({
        type: LocalToastType.CustomSystemNotice,
        customTitle: "Success",
        customBody: "Location updated successfully!",
        position: 'top'
      });
    } catch (err) {
      console.error("❌ Failed to save country/region:", err);
      showNotificationToastNative({
        type: LocalToastType.CustomSystemNotice,
        customTitle: "Error",
        customBody: "Failed to update location. Please try again.",
        position: 'top'
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditClick = async () => {
    await onEditStart(selectedCountry);
    setEditing(true);
  };

  const handleCountrySelect = async (countryValue: string) => {
    setSelectedCountry(countryValue);
    setSelectedRegion(""); // Reset region when country changes
    onTempCountryChange(countryValue);
    setShowCountryPicker(false);
    setError(null);
    
    // Fetch regions for new country
    await onEditStart(countryValue);
  };

  const handleRegionSelect = (regionValue: string) => {
    setSelectedRegion(regionValue);
    onTempRegionChange(regionValue);
    setShowRegionPicker(false);
    setError(null);
  };

  // Update local state when props change
  useEffect(() => {
    if (!editing) {
      setSelectedCountry(country);
      setSelectedRegion(region);
    }
  }, [country, region, editing]);

  // Fetch regions when country changes during editing
  useEffect(() => {
    if (!editing || !selectedCountry) return;

    const alreadyLoaded = regions.length > 0 && regions[0].label !== "-- Choose --";
    if (!alreadyLoaded) {
      onEditStart(selectedCountry);
    }
  }, [selectedCountry, editing, regions, onEditStart]);

  // Helper functions to get display labels
  const getCountryLabel = (value: string) => {
    const country = countries.find(c => c.value === value);
    return country ? country.label : value || "Not selected";
  };

  const getRegionLabel = (value: string) => {
    const region = regions.find(r => r.value === value);
    return region ? region.label : value || "Not selected";
  };

  return (
    <View style={styles.container}>
      {/* Label */}
      <Text style={styles.label}>Country & Region</Text>
      
      {/* Value or Pickers */}
      <View style={styles.valueContainer}>
        {editing ? (
          <View style={styles.editingContainer}>
            {/* Country Picker */}
            <TouchableOpacity
              style={[styles.pickerButton, styles.pickerButtonNormal]}
              onPress={() => setShowCountryPicker(true)}
              disabled={isSaving}
            >
              <Text style={styles.pickerButtonText}>
                {getCountryLabel(selectedCountry)}
              </Text>
              <Text style={styles.pickerButtonArrow}>▼</Text>
            </TouchableOpacity>

            {/* Region Picker */}
            <TouchableOpacity
              style={[styles.pickerButton, styles.pickerButtonNormal]}
              onPress={() => setShowRegionPicker(true)}
              disabled={isSaving || !selectedCountry}
            >
              <Text style={[
                styles.pickerButtonText,
                (!selectedCountry || regions.length === 0) && styles.pickerButtonTextDisabled
              ]}>
                {selectedRegion ? getRegionLabel(selectedRegion) : "Select region"}
              </Text>
              <Text style={styles.pickerButtonArrow}>▼</Text>
            </TouchableOpacity>

            {error && (
              <Text style={styles.errorText}>{error}</Text>
            )}
          </View>
        ) : (
          <View style={styles.displayContainer}>
            <View style={styles.displayValueContainer}>
              <Text style={styles.displayValue}>
                {getCountryLabel(country)}
              </Text>
            </View>
            <View style={styles.displayValueContainer}>
              <Text style={styles.displayValue}>
                {getRegionLabel(region)}
              </Text>
            </View>
          </View>
        )}
      </View>

      {/* Buttons */}
      <View style={styles.buttonsContainer}>
  {saved ? (
    <ButtonNative
      text="✓ Saved"
      onPress={() => {}}
      variant="primary"
      size="small"
      disabled={true}
    />
  ) : editing ? (
    <View style={styles.editingButtons}>
      <ButtonNative
        text={isSaving ? "Saving..." : "Save"}
        onPress={handleSave}
        variant="primary"
        size="small"
        loading={isSaving}
        disabled={isSaving || selectedRegion === ""}
        // Fjern fullWidth her
      />
      <ButtonNative
        text="Cancel"
        onPress={handleCancel}
        variant="secondary"
        size="small"
        disabled={isSaving}
        // Fjern fullWidth her
      />
          </View>
  ) : (
    <View style={styles.singleButtonContainer}>
      <ButtonNative
        text="Edit"
        onPress={handleEditClick}
        variant="primary"
        size="small"
      />
    </View>
  )}
      </View>

      {/* Country Picker Modal */}
      <Modal
        visible={showCountryPicker}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowCountryPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Select Country</Text>
                <CloseButtonNative 
                  onPress={() => setShowCountryPicker(false)}
                  theme="light"
                  size={32}
                  iconSize={16}
                />
              </View>
              
              <ScrollView 
                style={styles.optionsList}
                contentContainerStyle={styles.optionsListContent}
                showsVerticalScrollIndicator={true}
              >
                {countries.map((country) => (
                  <TouchableOpacity
                    key={country.value}
                    style={[
                      styles.optionItem,
                      selectedCountry === country.value && styles.optionItemSelected
                    ]}
                    onPress={() => handleCountrySelect(country.value)}
                  >
                    <Text style={[
                      styles.optionText,
                      selectedCountry === country.value && styles.optionTextSelected
                    ]}>
                      {country.label}
                    </Text>
                    {selectedCountry === country.value && (
                      <Text style={styles.optionCheckmark}>✓</Text>
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
        </View>
      </Modal>

      {/* Region Picker Modal */}
      <Modal
        visible={showRegionPicker}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowRegionPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Select Region</Text>
                <CloseButtonNative 
                  onPress={() => setShowRegionPicker(false)}
                  theme="light"
                  size={32}
                  iconSize={16}
                />
              </View>
              
              <ScrollView 
                style={styles.optionsList}
                contentContainerStyle={styles.optionsListContent}
                showsVerticalScrollIndicator={true}
              >
                {regions.map((region) => (
                  <TouchableOpacity
                    key={region.value}
                    style={[
                      styles.optionItem,
                      selectedRegion === region.value && styles.optionItemSelected
                    ]}
                    onPress={() => handleRegionSelect(region.value)}
                  >
                    <Text style={[
                      styles.optionText,
                      selectedRegion === region.value && styles.optionTextSelected
                    ]}>
                      {region.label}
                    </Text>
                    {selectedRegion === region.value && (
                      <Text style={styles.optionCheckmark}>✓</Text>
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
    textAlign: 'center',
  },
  
  valueContainer: {
    marginBottom: 12,
  },
  
  displayContainer: {
    gap: 8,
  },
  
  displayValueContainer: {
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    minHeight: 44,
    justifyContent: 'center',
  },
  
  displayValue: {
    fontSize: 16,
    color: '#111827',
    textAlign: 'center',
  },
  
  editingContainer: {
    gap: 12,
  },
  
  pickerButton: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#ffffff',
    minHeight: 44,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  
  pickerButtonNormal: {
    borderColor: '#d1d5db',
  },
  
  pickerButtonText: {
    fontSize: 16,
    color: '#111827',
    flex: 1,
    textAlign: 'center',
  },
  
  pickerButtonTextDisabled: {
    color: '#9ca3af',
  },
  
  pickerButtonArrow: {
    fontSize: 12,
    color: '#6b7280',
    marginLeft: 8,
  },
  
  errorText: {
    color: '#ef4444',
    fontSize: 12,
    textAlign: 'center',
    fontWeight: '500',
  },
  
  buttonsContainer: {
    alignItems: 'center', // Add this to ensure full width
  },

  editingButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
    justifyContent: 'center',
  },
    
  // Fixed Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  
  modalContainer: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: screenHeight * 0.7, // 70% of screen height
    width: '100%',
  },
  
  modalContent: {
    flex: 1,
    paddingBottom: 20,
  },
  
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    backgroundColor: '#ffffff',
  },
  
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  
  optionsList: {
    flex: 1,
  },
  
  optionsListContent: {
    paddingBottom: 20,
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
    singleButtonContainer: {
    flexDirection: 'row',
  },
});