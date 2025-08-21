// components/signup/DemoFieldsNative.tsx
// Gender/dateofBirth til signup
import React from "react";
import { View, StyleSheet } from "react-native";
import SignUpFormFieldNative from "./SignUpFormFieldNative";
import { FieldName } from "@shared/utils/validators";
import { FormDataType } from "@shared/types/form";
import DatePickerNative from "@/components/common/DatePickerNative";

interface Props {
  formData: FormDataType;
  handleChange: (name: FieldName, value: string) => void;
  handleBlur: (name: FieldName) => void;
  errors: Record<string, string>;
  touchedFields: Partial<Record<FieldName, boolean>>;
}

export default function SignUpDemoFieldsNative({
  formData,
  handleChange,
  handleBlur,
  errors,
  touchedFields,
}: Props) {
  return (
    <View style={styles.container}>
      {/* Gender Field */}
      <SignUpFormFieldNative
        id="gender"
        label="Gender"
        as="select"
        value={formData.gender}
        onChangeText={(value) => handleChange("gender", value)}
        onBlur={() => handleBlur("gender")}
        error={errors.gender}
        touched={touchedFields.gender}
        placeholder="Select Gender"
        options={[
          { label: "Male", value: "Male" },
          { label: "Female", value: "Female" },
          { label: "Unspecified", value: "Unspecified" },
        ]}
        tooltip="Required: For personalization and filtering."
      />

      {/* Date of Birth Field */}
      <DatePickerNative
        id="dateOfBirth"
        label="Date of Birth"
        value={formData.dateOfBirth}
        onChangeText={(value) => handleChange("dateOfBirth", value)}
        onBlur={() => handleBlur("dateOfBirth")}
        error={errors.dateOfBirth}
        touched={touchedFields.dateOfBirth}
        placeholder="Select your birth date"
        tooltip="Required: For age verification."
        maxDate={new Date()} // Can't select future dates
        minDate={new Date(1900, 0, 1)} // Can't select before 1900
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 16, // Space between fields
  },
});