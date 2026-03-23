// features/auth/components/SignUpCountryFieldNative.tsx
// Enkelt land-felt til signup — kun land, ingen region eller postnummer.
// Land beholdes for GDPR-formål.
import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useUnistyles } from "react-native-unistyles";
import { useTranslation } from "react-i18next";
import SearchableSelectModalNative from "@/components/common/modal/SearchableSelectModal";
import LabelWithTooltipNative from "@/components/common/buttons/LabelWithTooltipNative";
import { useModal } from "@/context/ModalContext";
import { FieldName } from "@shared/utils/validators";
import { FormDataType } from "@shared/types/form";
import { SelectOption } from "@shared/types/select";

interface Props {
  formData: FormDataType;
  handleChange: (name: FieldName, value: string) => void;
  errors: Record<string, string>;
  touchedFields: Partial<Record<FieldName, boolean>>;
  countries: SelectOption[];
}

export default function SignUpCountryFieldNative({
  formData, handleChange, errors, touchedFields, countries,
}: Props) {
  const { theme } = useUnistyles();
  const { t } = useTranslation();
  const { showModal, hideModal } = useModal();

  const showCountryPicker = () => {
    showModal(
      <SearchableSelectModalNative
        title={t("auth.selectCountryModal")}
        options={countries}
        selectedValue={formData.country}
        onSelect={(value) => handleChange("country", value)}
        onClose={hideModal}
        placeholder={t("auth.searchCountries")}
      />,
      { blurBackground: true, dismissOnBackdrop: true, type: "center" }
    );
  };

  const getCountryLabel = () => {
    const country = countries.find((c) => c.value === formData.country);
    return country ? country.label : t("auth.selectCountry");
  };

  const hasError = !!(touchedFields.country && errors.country);

  return (
    <View style={{ marginBottom: theme.spacing.md }}>
      <LabelWithTooltipNative label={t("auth.country")} tooltip={t("auth.countryTooltip")} />
      <TouchableOpacity
        style={{
          height: 48,
          paddingHorizontal: theme.spacing.md,
          borderWidth: 1,
          borderColor: hasError ? theme.colors.borderError : theme.colors.border,
          borderRadius: theme.radii.md,
          backgroundColor: theme.colors.backgroundInput,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
        onPress={showCountryPicker}
      >
        <Text style={{
          fontSize: theme.typography.md,
          color: formData.country ? theme.colors.textPrimary : theme.colors.textPlaceholder,
          flex: 1,
        }}>
          {getCountryLabel()}
        </Text>
        <Ionicons name="chevron-down" size={20} color={theme.colors.textMuted} />
      </TouchableOpacity>
      {hasError && (
        <Text style={{ color: theme.colors.error, fontSize: theme.typography.sm, marginTop: 4 }}>
          {errors.country}
        </Text>
      )}
    </View>
  );
}
