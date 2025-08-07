// Gender/dateofBirth til signup
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

export default function DemoFields({
  formData,
  handleChange,
  handleBlur,
  errors,
  touchedFields,
}: Props) {
  return (
    <>
      <FormField
        id="gender"
        label="Gender:"
        as="select"
        value={formData.gender}
        onChange={(e) => handleChange("gender", e.target.value)}
        onBlur={() => handleBlur("gender")}
        error={errors.gender}
        touched={touchedFields.gender}
        options={[
          { label: "Select Gender", value: "" },
          { label: "Male", value: "Male" },
          { label: "Female", value: "Female" },
          { label: "Unspecified", value: "Unspecified" },
        ]}
        tooltip="Required: For personalization and filtering."
      />

      <FormField
        id="dateOfBirth"
        label="Date of birth:"
        type="date"
        value={formData.dateOfBirth}
        onChange={(e) => handleChange("dateOfBirth", e.target.value)}
        onBlur={() => handleBlur("dateOfBirth")}
        error={errors.dateOfBirth}
        touched={touchedFields.dateOfBirth}
        tooltip="Required: For age verification."
      />
    </>
  );
}