// components/signup/ContactFieldsNative.tsx
// Epost og phone i signup
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

export default function SignUpContactFieldsNative({
  formData,
  handleChange,
  handleBlur,
  errors,
  touchedFields,
}: Props) {
  return (
    <View style={styles.container}>
      {/* Email Field */}
      <SignUpFormFieldNative
        id="email"
        label="Email"
        type="email"
        value={formData.email}
        onChangeText={(value) => handleChange("email", value)}
        onBlur={() => handleBlur("email")}
        error={errors.email}
        touched={touchedFields.email}
        placeholder="Your email address"
        tooltip="Required: Email. Only one user per email. Max characters: 100."
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
      />

      {/* Phone Field */}
      <SignUpFormFieldNative
        id="phone"
        label="Phone Number (optional)"
        type="tel"
        value={formData.phone ?? ""}
        onChangeText={(value) => handleChange("phone", value)}
        onBlur={() => handleBlur("phone")}
        error={errors.phone}
        touched={touchedFields.phone}
        placeholder="Your phone number"
        tooltip="Not required: Must be a valid phonenumber. Might be used for verification later."
        keyboardType="phone-pad"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 16, // Space between fields
  },
});