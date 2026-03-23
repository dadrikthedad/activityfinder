// features/auth/components/SignUpPasswordSimpleFieldNative.tsx
import React from "react";
import { View } from "react-native";
import { useTranslation } from "react-i18next";
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

export default function SignUpPasswordSimpleFieldNative({ formData, handleChange, handleBlur, errors, touchedFields }: Props) {
  const { t } = useTranslation();

  return (
    <View style={{ gap: 16 }}>
      <SignUpPasswordFieldNative
        id="password"
        label={t("auth.createPassword")}
        value={formData.password}
        onChangeText={(value) => handleChange("password", value)}
        onBlur={() => handleBlur("password")}
        error={errors.password}
        touched={touchedFields.password}
        placeholder={t("auth.createPasswordPlaceholder")}
        tooltip={t("auth.passwordTooltip")}
      />
      <SignUpPasswordFieldNative
        id="confirmPassword"
        label={t("auth.confirmPassword")}
        value={formData.confirmPassword}
        onChangeText={(value) => handleChange("confirmPassword", value)}
        onBlur={() => handleBlur("confirmPassword")}
        error={errors.confirmPassword}
        touched={touchedFields.confirmPassword}
        placeholder={t("auth.confirmPasswordPlaceholder")}
        tooltip={t("auth.confirmPasswordTooltip")}
      />
    </View>
  );
}
