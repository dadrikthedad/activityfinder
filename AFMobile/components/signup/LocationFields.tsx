// # Land, region og postalcode til signup
import FormField from "@/components/FormField";
import { FieldName } from "@/utils/validators";
import { FormDataType } from "@shared/types/form";
import { SelectOption } from "@shared/types/select";

interface Props {
  formData: FormDataType;
  handleChange: (name: FieldName, value: string) => void;
  handleBlur: (name: FieldName) => void;
  errors: Record<string, string>;
  touchedFields: Partial<Record<FieldName, boolean>>;
  countries: SelectOption[];
  regions: SelectOption[];
  handleCountryChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
}

export default function LocationFields({
  formData,
  handleChange,
  handleBlur,
  errors,
  touchedFields,
  countries,
  regions,
  handleCountryChange,
}: Props) {
  return (
    <>
      <FormField
        id="country"
        label="Country:"
        value={formData.country}
        onChange={(e) => handleCountryChange(e)}
        error={errors.country}
        touched={touchedFields.country}
        tooltip="Required: Country. Required to follow the law."
        as="select"
        options={countries}
        placeholder="Select a country"
        />

      <FormField
        id="region"
        label="Region:"
        value={formData.region ?? ""}
        onChange={(e) => handleChange("region", e.target.value)}
        error={errors.region}
        touched={touchedFields.region}
        tooltip="Required: Region. For updates in your region."
        as="select"
        options={regions}
        disabled={!formData.country}
      />

      <FormField
        id="postalCode"
        label="Postal code:"
        value={formData.postalCode ?? ""}
        onChange={(e) => handleChange("postalCode", e.target.value)}
        onBlur={() => handleBlur("postalCode")}
        error={errors.postalCode}
        touched={touchedFields.postalCode}
        placeholder="Postal code (not required)"
        tooltip="Not required: For updates in your area."
      />
    </>
  );
}