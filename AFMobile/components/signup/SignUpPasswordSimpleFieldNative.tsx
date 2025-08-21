// components/signup/PasswordFieldsNative.tsx
// Passord og bekreft-passord til signup, bruker PasswordFieldAdvancedNative.tsx
import React from "react";
import { View, StyleSheet } from "react-native";
import SignUpPasswordFieldNative from "./SignUpPasswordFieldsNative";
import { FieldName } from "@shared/utils/validators";
import { FormDataType } from "@shared/types/form";

interface Props {
  formData: FormDataType;
  handleChange: (name: FieldName, value: string) => void;
  handleBlur: (name: FieldName) => void;
  errors: Record<string, string>;
  touchedFields: Partial<Record<FieldName, boolean>>;
}

export default function SignUpPasswordSimpleFieldNative({
  formData,
  handleChange,
  handleBlur,
  errors,
  touchedFields,
}: Props) {
  return (
    <View style={styles.container}>
      {/* Password Field */}
      <SignUpPasswordFieldNative
        id="password"
        label="Password"
        value={formData.password}
        onChangeText={(value) => handleChange("password", value)}
        onBlur={() => handleBlur("password")}
        error={errors.password}
        touched={touchedFields.password}
        placeholder="Create a password"
        tooltip="Password must contain uppercase, lowercase and a number. 8-128 chars."
      />

      {/* Confirm Password Field */}
      <SignUpPasswordFieldNative
        id="confirmPassword"
        label="Confirm Password"
        value={formData.confirmPassword}
        onChangeText={(value) => handleChange("confirmPassword", value)}
        onBlur={() => handleBlur("confirmPassword")}
        error={errors.confirmPassword}
        touched={touchedFields.confirmPassword}
        placeholder="Confirm your password"
        tooltip="Must match your password."
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 16, // Space between fields
  },
});