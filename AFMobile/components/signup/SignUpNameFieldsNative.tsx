
// Navnfeltene til signup
import React from "react";
import { View, StyleSheet } from "react-native";
import SignUpFormFieldNative from "./SignUpFormFieldNative";
import { FieldName } from "@shared/utils/validators";
import { FormDataType } from "@shared/types/form";

interface Props {
  formData: FormDataType;
  handleChange: (name: FieldName, value: string) => void;
  handleBlur: (name: FieldName) => void;
  errors: Record<string, string>;
  touchedFields: Partial<Record<FieldName, boolean>>;
}

export default function SignUpNameFieldsNative({
  formData,
  handleChange,
  handleBlur,
  errors,
  touchedFields,
}: Props) {
  return (
    <View style={styles.container}>
      {/* First Name */}
      <SignUpFormFieldNative
        id="firstName"
        label="First Name"
        type="text"
        value={formData.firstName}
        onChangeText={(value) => handleChange("firstName", value)}
        onBlur={() => handleBlur("firstName")}
        error={errors.firstName}
        touched={touchedFields.firstName}
        placeholder="Your first name"
        tooltip="Required: Your first name. Max characters: 50."
        autoCapitalize="words"
        autoCorrect={false}
        maxLength={50}
      />

      {/* Middle Name */}
      <SignUpFormFieldNative
        id="middleName"
        label="Middle Name (optional)"
        type="text"
        value={formData.middleName ?? ""}
        onChangeText={(value) => handleChange("middleName", value)}
        onBlur={() => handleBlur("middleName")}
        error={errors.middleName}
        touched={touchedFields.middleName}
        placeholder="Your middle name"
        tooltip="Not required: Your middle name. Max characters: 50."
        autoCapitalize="words"
        autoCorrect={false}
        maxLength={50}
      />

      {/* Last Name */}
      <SignUpFormFieldNative
        id="lastName"
        label="Last Name"
        type="text"
        value={formData.lastName}
        onChangeText={(value) => handleChange("lastName", value)}
        onBlur={() => handleBlur("lastName")}
        error={errors.lastName}
        touched={touchedFields.lastName}
        placeholder="Your last name"
        tooltip="Required: Your last name. Max characters: 50."
        autoCapitalize="words"
        autoCorrect={false}
        maxLength={50}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 16, // Space between fields
  },
});