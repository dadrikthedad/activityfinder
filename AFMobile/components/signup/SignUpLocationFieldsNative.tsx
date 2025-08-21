// components/signup/LocationFieldsNative.tsx
// Land, region og postalcode til signup
import React from "react";
import { View, StyleSheet, TouchableOpacity, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import SignUpFormFieldNative from "./SignUpFormFieldNative";
import SearchableSelectModalNative from "../common/modal/SearchableSelectModal";
import LabelWithTooltipNative from "../common/buttons/LabelWithTooltipNative";
import { useModal } from "@/context/ModalContext";
import { FieldName } from "@shared/utils/validators";
import { FormDataType } from "@shared/types/form";
import { SelectOption } from "@shared/types/select";

interface Props {
  formData: FormDataType;
  handleChange: (name: FieldName, value: string) => void;
  handleBlur: (name: FieldName) => void;
  errors: Record<string, string>;
  touchedFields: Partial<Record<FieldName, boolean>>;
  countries: SelectOption[];
  regions: SelectOption[];
  handleCountryChange: (selectedCountry: string) => Promise<void>;
}

export default function SignUpLocationFieldsNative({
  formData,
  handleChange,
  handleBlur,
  errors,
  touchedFields,
  countries,
  regions,
  handleCountryChange,
}: Props) {
  const { showModal, hideModal } = useModal();

  const handleCountrySelect = async (selectedCountry: string) => {
    // First update the country in form data
    handleChange("country", selectedCountry);
    
    // Clear the region since country changed
    handleChange("region", "");
    
    // Fetch regions for the new country
    await handleCountryChange(selectedCountry);
    
    // Don't call handleBlur - no live validation for these fields
  };

  const handleRegionSelect = (selectedRegion: string) => {
    handleChange("region", selectedRegion);
    
    // Don't call handleBlur - no live validation for these fields
  };

  const showCountryPicker = () => {
    showModal(
      <SearchableSelectModalNative
        title="Select Country"
        options={countries}
        selectedValue={formData.country}
        onSelect={handleCountrySelect}
        onClose={hideModal}
        placeholder="Search countries..."
      />,
      {
        blurBackground: true,
        dismissOnBackdrop: true,
        type: 'center'
      }
    );
  };

  const showRegionPicker = () => {
    showModal(
      <SearchableSelectModalNative
        title="Select Region"
        options={regions}
        selectedValue={formData.region ?? ""}
        onSelect={handleRegionSelect}
        onClose={hideModal}
        placeholder="Search regions..."
      />,
      {
        blurBackground: true,
        dismissOnBackdrop: true,
        type: 'center'
      }
    );
  };

  const getCountryLabel = () => {
    const country = countries.find(c => c.value === formData.country);
    return country ? country.label : "Select a country";
  };

  const getRegionLabel = () => {
    const region = regions.find(r => r.value === formData.region);
    return region ? region.label : 
      !formData.country ? "Select a country first" : "Select a region";
  };

  return (
    <View style={styles.container}>
      {/* Country Field */}
      <View style={styles.fieldContainer}>
        <LabelWithTooltipNative 
          label="Country" 
          tooltip="Required: Country. Required to follow the law." 
        />
        
        <TouchableOpacity
          style={[
            styles.selectButton,
            // Only show error styling on submit (when touched via handleSubmitNative)
            touchedFields.country && errors.country && styles.selectButtonError,
          ]}
          onPress={showCountryPicker}
        >
          <Text
            style={[
              styles.selectText,
              !formData.country && styles.placeholderText,
            ]}
          >
            {getCountryLabel()}
          </Text>
          <Ionicons 
            name="chevron-down" 
            size={20} 
            color="#6b7280" 
          />
        </TouchableOpacity>

        {/* Only show error on submit */}
        {touchedFields.country && errors.country && (
          <Text style={styles.errorText}>{errors.country}</Text>
        )}
      </View>

      {/* Region Field */}
      <View style={styles.fieldContainer}>
        <LabelWithTooltipNative 
          label="Region" 
          tooltip="Required: Region. For updates in your region." 
        />
        
        <TouchableOpacity
          style={[
            styles.selectButton,
            // Only show error styling on submit (when touched via handleSubmitNative)
            touchedFields.region && errors.region && styles.selectButtonError,
            !formData.country && styles.selectButtonDisabled,
          ]}
          onPress={formData.country ? showRegionPicker : undefined}
          disabled={!formData.country}
        >
          <Text
            style={[
              styles.selectText,
              !formData.region && styles.placeholderText,
              !formData.country && styles.disabledText,
            ]}
          >
            {getRegionLabel()}
          </Text>
          <Ionicons 
            name="chevron-down" 
            size={20} 
            color={!formData.country ? "#9ca3af" : "#6b7280"} 
          />
        </TouchableOpacity>

        {/* Only show error on submit */}
        {touchedFields.region && errors.region && (
          <Text style={styles.errorText}>{errors.region}</Text>
        )}
      </View>

      {/* Postal Code Field - Regular text input */}
      <SignUpFormFieldNative
        id="postalCode"
        label="Postal Code (optional)"
        type="text"
        value={formData.postalCode ?? ""}
        onChangeText={(value) => handleChange("postalCode", value)}
        onBlur={() => handleBlur("postalCode")}
        error={errors.postalCode}
        touched={touchedFields.postalCode}
        placeholder="Postal code"
        tooltip="Not required: For updates in your area."
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 16, // Space between fields
  },
  fieldContainer: {
    marginBottom: 16,
  },
  selectButton: {
    height: 48,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    backgroundColor: "#ffffff",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  selectButtonError: {
    borderColor: "#dc2626",
  },
  selectButtonDisabled: {
    backgroundColor: "#f9fafb",
    borderColor: "#e5e7eb",
  },
  selectText: {
    fontSize: 16,
    color: "#374151",
    flex: 1,
  },
  placeholderText: {
    color: "#9ca3af",
  },
  disabledText: {
    color: "#9ca3af",
  },
  errorText: {
    color: "#dc2626",
    fontSize: 14,
    marginTop: 4,
  },
});