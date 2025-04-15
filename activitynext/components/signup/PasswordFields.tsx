// Passord og bekreft-passord til signup, bruker PasswordField.tsx
import PasswordField from "@/components/PasswordField";
import { FieldName } from "@/utils/validators";
import { FormDataType } from "@/types/form";

interface Props {
  formData: FormDataType;
  handleChange: (name: FieldName, value: string) => void;
  handleBlur: (name: FieldName) => void;
  errors: Record<string, string>;
  touchedFields: Partial<Record<FieldName, boolean>>;
}

export default function PasswordFields({ formData, handleChange, handleBlur, errors, touchedFields }: Props) {
  return (
    <>
      <PasswordField
        id="password"
        label="Password:"
        value={formData.password}
        onChange={(e) => handleChange("password", e.target.value)}
        onBlur={() => handleBlur("password")}
        error={errors.password}
        touched={touchedFields.password}
        placeholder="Password"
        tooltip="Password must contain uppercase, lowercase and a number. 8-128 chars."
      />

      <PasswordField
        id="confirmPassword"
        label="Confirm Password:"
        value={formData.confirmPassword}
        onChange={(e) => handleChange("confirmPassword", e.target.value)}
        onBlur={() => handleBlur("confirmPassword")}
        error={errors.confirmPassword}
        touched={touchedFields.confirmPassword}
        placeholder="Confirm Password"
        tooltip="Must match your password."
      />
    </>
  );
}