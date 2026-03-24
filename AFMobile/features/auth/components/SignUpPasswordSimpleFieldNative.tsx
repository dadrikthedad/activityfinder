// features/auth/components/SignUpPasswordSimpleFieldNative.tsx
import React from "react";
import { View } from "react-native";
import { useTranslation } from "react-i18next";
import PasswordFieldNative from "@/components/common/PasswordFieldNative";
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
  formData, handleChange, handleBlur, errors, touchedFields,
}: Props) {
  const { t } = useTranslation();

  return (
    <View style={{ gap: 16 }}>
      <PasswordFieldNative
        id="password"
        label={t("auth.createPassword")}
        tooltip={t("auth.passwordTooltip")}
        labelAlign="left"
        value={formData.password}
        onChangeText={(value) => handleChange("password", value)}
        onBlur={() => handleBlur("password")}
        error={errors.password}
        touched={touchedFields.password}
        placeholder={t("auth.createPasswordPlaceholder")}
      />
      <PasswordFieldNative
        id="confirmPassword"
        label={t("auth.confirmPassword")}
        tooltip={t("auth.confirmPasswordTooltip")}
        labelAlign="left"
        value={formData.confirmPassword}
        onChangeText={(value) => handleChange("confirmPassword", value)}
        onBlur={() => handleBlur("confirmPassword")}
        error={errors.confirmPassword}
        touched={touchedFields.confirmPassword}
        placeholder={t("auth.confirmPasswordPlaceholder")}
      />
    </View>
  );
}
