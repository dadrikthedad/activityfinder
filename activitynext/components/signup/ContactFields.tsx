// Epost og phone i signup
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

export default function ContactFields({
  formData,
  handleChange,
  handleBlur,
  errors,
  touchedFields,
}: Props) {
  return (
    <>
      {/* 🔥 E-POST */}
      <FormField
        id="email"
        label="Email:"
        type="email"
        value={formData.email}
        onChange={(e) => handleChange("email", e.target.value)}
        onBlur={() => handleBlur("email")}
        error={errors.email}
        touched={touchedFields.email}
        placeholder="Email"
        tooltip="Required: Email. Only one user per email. Max characters: 100."
      />

      {/* 🔥 Phone */}
      <FormField
        id="phone"
        label="Phonenumber (not required):"
        type="tel"
        value={formData.phone ?? ""}
        onChange={(e) => handleChange("phone", e.target.value)}
        onBlur={() => handleBlur("phone")}
        error={errors.phone}
        touched={touchedFields.phone}
        placeholder="Phonenumber"
        tooltip="Not required: Must be a valid phonenumber. Might be used for verification later."
      />
    </>
  );
}