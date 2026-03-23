// features/auth/components/SignUpNameFieldsNative.tsx
import React from "react";
import { View } from "react-native";
import { useTranslation } from "react-i18next";
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

export default function SignUpNameFieldsNative({ formData, handleChange, handleBlur, errors, touchedFields }: Props) {
  const { t } = useTranslation();

  return (
    <View style={{ gap: 16 }}>
      <SignUpFormFieldNative
        id="firstName"
        label={t("auth.firstName")}
        type="text"
        value={formData.firstName}
        onChangeText={(value) => handleChange("firstName", value)}
        onBlur={() => handleBlur("firstName")}
        error={errors.firstName}
        touched={touchedFields.firstName}
        placeholder={t("auth.firstNamePlaceholder")}
        tooltip={t("auth.firstNameTooltip")}
        autoCapitalize="words"
        autoCorrect={false}
        maxLength={50}
      />
      <SignUpFormFieldNative
        id="lastName"
        label={t("auth.lastName")}
        type="text"
        value={formData.lastName}
        onChangeText={(value) => handleChange("lastName", value)}
        onBlur={() => handleBlur("lastName")}
        error={errors.lastName}
        touched={touchedFields.lastName}
        placeholder={t("auth.lastNamePlaceholder")}
        tooltip={t("auth.lastNameTooltip")}
        autoCapitalize="words"
        autoCorrect={false}
        maxLength={50}
      />
    </View>
  );
}
