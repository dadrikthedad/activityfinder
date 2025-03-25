import { Info } from "lucide-react";
import React from "react";

interface FormFieldProps {
  id: string;
  label: string;
  tooltip?: string;
  type?: string;
  value: string;
  onChange: (
    e: React.ChangeEvent<HTMLInputElement> | React.ChangeEvent<HTMLSelectElement>
  ) => void;
  onBlur?: (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => void;
  error?: string;
  touched?: boolean;
  placeholder?: string;
  as?: "input" | "select";
  options?: { label: string; value: string }[];
  disabled?: boolean;
}

const FormField: React.FC<FormFieldProps> = ({
  id,
  label,
  tooltip,
  type = "text",
  value,
  onChange,
  onBlur,
  error,
  touched,
  placeholder,
  as = "input",
  options = [],
  disabled = false,
}) => {
  const showError = touched && error;

  return (
    <>
      <label htmlFor={id} className="text-gray-300 font-medium text-right">
        {label}
      </label>

      <div className="flex flex-col w-full">
        {as === "input" ? (
          <input
            id={id}
            type={type}
            name={id}
            value={value}
            onChange={onChange}
            onBlur={onBlur}
            placeholder={placeholder}
            disabled={disabled}
            className={`w-full h-12 px-4 border rounded-md bg-gray-700 text-white 
              ${showError ? "border-red-500" : "border-gray-500"}`}
          />
        ) : (
          <select
            id={id}
            name={id}
            value={value}
            onChange={onChange}
            onBlur={onBlur}
            disabled={disabled}
            className={`w-full h-12 px-4 border rounded-md bg-gray-700 text-white 
              ${showError ? "border-red-500" : "border-gray-500"}`}
          >
            {options.map((opt, index) => (
            <option key={`${opt.value}-${index}`} value={opt.value}>
                {opt.label}
            </option>
            ))}
          </select>
        )}
        {showError && <p className="text-red-500 text-sm mt-1">{error}</p>}
      </div>

      {/* Tooltip */}
      {tooltip ? (
        <div className="relative flex justify-start group">
          <Info className="text-gray-400 cursor-pointer" size={18} />
          <div className="absolute left-6 bottom-full mb-2 hidden group-hover:flex 
              bg-gray-800 text-white text-xs p-2 rounded-md shadow-md w-40 z-10">
            {tooltip}
          </div>
        </div>
      ) : (
        <div /> // Keeps grid layout aligned
      )}
    </>
  );
};

export default FormField;
