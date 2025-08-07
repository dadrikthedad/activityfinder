// Navnfeltene til signup
import FormField from "@/components/FormField";
import { FieldName } from "@shared/utils/validators";
import { FormDataType } from "@shared/types/form";

interface Props {
  formData: FormDataType;
  handleChange: (name: FieldName, value: string) => void;
  handleBlur: (name: FieldName) => void;
  errors: Record<string, string>;
  touchedFields: Partial<Record<FieldName, boolean>>;
}

export default function NameFields({
  formData,
  handleChange,
  handleBlur,
  errors,
  touchedFields,
}: Props) {
  return (
    <>
      {/* 🔥 FORNAVN */}
      <FormField
        id="firstName"
        label="First name:"
        value={formData.firstName}
        onChange={(e) => handleChange("firstName", e.target.value)}
        onBlur={() => handleBlur("firstName")}
        error={errors.firstName}
        touched={touchedFields.firstName}
        placeholder="First name"
        tooltip="Required: Your first name. Max characters: 50."
      />

      {/* 🔥 MELLOMNAVN */}
      <FormField
        id="middleName"
        label="Middle name (not required):"
        value={formData.middleName ?? ""}
        onChange={(e) => handleChange("middleName", e.target.value)}
        onBlur={() => handleBlur("middleName")}
        error={errors.middleName}
        touched={touchedFields.middleName}
        placeholder="Middle name (not required)"
        tooltip="Not required: Your middle name. Max characters: 50."
      />

      {/* 🔥 ETTERNAVN */}
      <FormField
        id="lastName"
        label="Last name:"
        value={formData.lastName}
        onChange={(e) => handleChange("lastName", e.target.value)}
        onBlur={() => handleBlur("lastName")}
        error={errors.lastName}
        touched={touchedFields.lastName}
        placeholder="Last name"
        tooltip="Required: Your last name. Max characters: 50."
      />
    </>
  );
}
